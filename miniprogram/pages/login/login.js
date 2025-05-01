// pages/login/login.js
Page({
  data: {
    canIUseGetUserProfile: false,
    userInfo: null,
    hasUserInfo: false,
    isLoggingIn: false,
    isWechatPlatform: true, // 
    phoneNumber: '', // 
    showPhoneInput: false, // 
    phoneNumberValid: false // 
  },

  onLoad() {
    // 
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
    
    // 
    this.checkPlatform();
  },

  // 
  checkPlatform() {
    // 
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      try {
        const systemInfo = wx.getSystemInfoSync();
        // 
        if (systemInfo.platform && (systemInfo.platform === 'ios' || systemInfo.platform === 'android') && systemInfo.environment === 'wxmp') {
          this.setData({ 
            isWechatPlatform: true,
            showPhoneInput: false
          });
        } else {
          // 
          this.setData({ 
            isWechatPlatform: false,
            showPhoneInput: true
          });
        }
      } catch (e) {
        // 
        console.error('', e);
        this.setData({ 
          isWechatPlatform: false,
          showPhoneInput: true
        });
      }
    } else {
      // wx 
      this.setData({ 
        isWechatPlatform: false,
        showPhoneInput: true
      });
    }
  },

  // 
  authorizeAndLogin() {
    if (this.data.isLoggingIn) return; // 
    
    this.setData({ isLoggingIn: true });
    
    // 
    if (!this.data.isWechatPlatform) {
      this.nonWechatLogin();
      return;
    }
    
    // 
    wx.showModal({
      title: '',
      content: '',
      confirmText: '',
      cancelText: '',
      success: (res) => {
        if (res.confirm) {
          // 
          this.getUserProfileInfo();
        } else {
          // 
          console.log('');
          this.setData({ isLoggingIn: false });
          this.wxLogin();
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
      }
    });
  },

  // 
  getUserProfileInfo() {
    if (this.data.canIUseGetUserProfile) {
      wx.getUserProfile({
        desc: '', // 
        success: (res) => {
          console.log('getUserProfile success', res);
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          });
          // 
          getApp().globalData.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          
          // 
          this.wxLogin();
        },
        fail: (err) => {
          console.error('getUserProfile fail', err);
          // 
          this.setData({ isLoggingIn: false });
          wx.showToast({
            title: '',
            icon: 'none',
            complete: () => {
              // 
              setTimeout(() => {
                this.wxLogin();
              }, 1500);
            }
          });
        }
      });
    } else {
      // 
      wx.getUserInfo({
        success: (res) => {
          console.log('getUserInfo success', res);
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          });
          // 
          getApp().globalData.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          
          // 
          this.wxLogin();
        },
        fail: (err) => {
          console.error('getUserInfo fail', err);
          // 
          this.wxLogin();
        }
      });
    }
  },

  // 
  getPhoneNumber(e) {
    if (e.detail.code) {
      // 
      this.setData({
        phoneCode: e.detail.code
      });
      
      // 
      this.wxLogin();
    } else {
      console.error('', e.detail.errMsg);
      // 
      this.wxLogin();
    }
  },

  // 
  wxLogin() {
    wx.showLoading({
      title: '',
    });

    wx.login({
      success: (res) => {
        if (res.code) {
          // 
          this.serverLogin(res.code);
        } else {
          this.setData({ isLoggingIn: false });
          wx.hideLoading();
          wx.showToast({
            title: '',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '',
          icon: 'none'
        });
      }
    });
  },

  // 
  serverLogin(code) {
    const app = getApp();
    
    // 
    const data = { code };
    console.log(this.data.userInfo);
    console.log(this.data.hasUserInfo);


    // 
    if (this.data.hasUserInfo && this.data.userInfo) {
      data.nickname = this.data.userInfo.nickName || '';
      data.avatarUrl = this.data.userInfo.avatarUrl || '';
      data.gender = this.data.userInfo.gender || 0;
      data.country = this.data.userInfo.country || '';
      data.province = this.data.userInfo.province || '';
      data.city = this.data.userInfo.city || '';
    }
    
    // 
    if (this.data.phoneCode) {
      data.phoneCode = this.data.phoneCode;
    }
    
    // 
    if (!this.data.isWechatPlatform && this.data.phoneNumber) {
      data.manualPhoneNumber = this.data.phoneNumber;
    }
    
    console.log(data);
    wx.request({
      url: app.globalData.baseUrl + '/api/wx/login',
      method: 'GET',
      data: data,
      success: (res) => {
        console.log(res);
        wx.hideLoading();
        this.setData({ isLoggingIn: false });
        
        if (res.statusCode === 200 && res.data && res.data.data && res.data.data.jwtToken) {
          // 
          const token = res.data.data.jwtToken;
          app.globalData.token = token;
          app.globalData.isLogin = true;
          wx.setStorageSync('token', token);
          
          // 
          if (res.data.data.uid) {
            wx.setStorageSync('uid', res.data.data.uid);
          }
          
          console.log('token saved:', token);
          
          // 
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            // 
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        } else {
          wx.showToast({
            title: res.data.message || '',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '',
          icon: 'none'
        });
      }
    });
  },
  
  // 
  skipAuthLogin() {
    if (this.data.isLoggingIn) return; // 
    
    this.setData({ isLoggingIn: true });
    
    // 
    if (this.data.isWechatPlatform) {
      this.wxLogin();
    } else {
      this.anonymousLogin(); // 
    }
  },
  
  // 
  nonWechatLogin() {
    wx.showLoading({
      title: '',
    });
    
    // 
    if (this.data.phoneNumber && this.data.phoneNumberValid) {
      // 
      this.serverLogin('non_wechat_platform');
    } else {
      // 
      wx.hideLoading();
      this.setData({ isLoggingIn: false });
      wx.showToast({
        title: '',
        icon: 'none'
      });
    }
  },
  
  // 
  anonymousLogin() {
    const app = getApp();
    
    wx.showLoading({
      title: '',
    });
    
    wx.request({
      url: app.globalData.baseUrl + '/api/wx/anonymous-login',
      method: 'GET',
      success: (res) => {
        console.log('', res);
        wx.hideLoading();
        this.setData({ isLoggingIn: false });
        
        if (res.statusCode === 200 && res.data && res.data.data && res.data.data.jwtToken) {
          // 
          const token = res.data.data.jwtToken;
          app.globalData.token = token;
          app.globalData.isLogin = true;
          wx.setStorageSync('token', token);
          
          // 
          if (res.data.data.uid) {
            wx.setStorageSync('uid', res.data.data.uid);
          }
          
          console.log('', token);
          
          // 
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            // 
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        } else {
          wx.showToast({
            title: res.data.message || '',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '',
          icon: 'none'
        });
      }
    });
  },
  
  // 
  phoneNumberInput(e) {
    const phoneNumber = e.detail.value;
    const phoneNumberValid = this.validatePhoneNumber(phoneNumber);
    
    this.setData({
      phoneNumber: phoneNumber,
      phoneNumberValid: phoneNumberValid
    });
  },
  
  // 
  validatePhoneNumber(phoneNumber) {
    // 
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  }
});
