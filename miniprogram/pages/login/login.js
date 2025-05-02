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
    phoneNumberValid: false, // 
    isMultiPlatformApp: false, // 
    verificationCode: '', // 
    verificationCodeValid: false, // 
    countDown: 0, // 
    countDownTimer: null // 
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

  onUnload() {
    // 
    if (this.data.countDownTimer) {
      clearInterval(this.data.countDownTimer);
    }
  },

  // 
  checkPlatform() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.log('', systemInfo);
      
      // 
      try {
        wx.login({
          success: () => {
            // wx.login
            this.setData({
              isWechatPlatform: true,
              showPhoneInput: false,
              isMultiPlatformApp: false
            });
            console.log('');
          },
          fail: (err) => {
            // wx.login
            console.log('wx.login', err);
            this.setData({
              isWechatPlatform: false,
              showPhoneInput: true,
              isMultiPlatformApp: true
            });
            console.log('');
          }
        });
      } catch (loginErr) {
        console.error('wx.login', loginErr);
        // 
        this.setData({
          isWechatPlatform: false,
          showPhoneInput: true,
          isMultiPlatformApp: true
        });
      }
    } catch (err) {
      console.error('', err);
      // 
      this.setData({
        isWechatPlatform: false,
        showPhoneInput: true,
        isMultiPlatformApp: true
      });
    }
  },

  // 
  authorizeAndLogin() {
    if (this.data.isLoggingIn) return; // 
    
    this.setData({ isLoggingIn: true });
    
    // 
    if (this.data.isMultiPlatformApp) {
      // 
      this.setData({
        showPhoneInput: true,
        isLoggingIn: false
      });
      wx.showToast({
        title: '',
        icon: 'none'
      });
    } else {
      // 
      this.wxLogin();
    }
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
    // 
    if (this.data.isMultiPlatformApp) {
      this.setData({ 
        isLoggingIn: false,
        showPhoneInput: true
      });
      return;
    }
    
    wx.showLoading({
      title: '',
    });

    try {
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('wx.login success, code:', res.code);
            // 
            this.serverLogin(res.code);
          } else {
            console.error('wx.login fail', res);
            this.setData({ isLoggingIn: false });
            wx.hideLoading();
            wx.showToast({
              title: '',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('wx.login fail', err);
          wx.hideLoading();
          
          // 
          if (err.errMsg && err.errMsg.includes('')) {
            console.log('');
            this.setData({
              isMultiPlatformApp: true,
              isWechatPlatform: false,
              showPhoneInput: true,
              isLoggingIn: false
            });
            
            wx.showToast({
              title: '',
              icon: 'none'
            });
          } else {
            this.setData({ isLoggingIn: false });
            wx.showToast({
              title: '',
              icon: 'none'
            });
          }
        }
      });
    } catch (err) {
      console.error('wx.login', err);
      wx.hideLoading();
      
      // 
      this.setData({
        isMultiPlatformApp: true,
        isWechatPlatform: false,
        showPhoneInput: true,
        isLoggingIn: false
      });
      
      wx.showToast({
        title: '',
        icon: 'none'
      });
    }
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
    const isValid = this.validatePhoneNumber(phoneNumber);
    
    this.setData({
      phoneNumber: phoneNumber,
      phoneNumberValid: isValid
    });
  },
  
  // 
  verificationCodeInput(e) {
    const code = e.detail.value;
    const isValid = this.validateVerificationCode(code);
    
    this.setData({
      verificationCode: code,
      verificationCodeValid: isValid
    });
  },
  
  // 
  validatePhoneNumber(phoneNumber) {
    // 
    const phoneRegex = /^1\d{10}$/;
    return phoneRegex.test(phoneNumber);
  },
  
  // 
  validateVerificationCode(code) {
    // 
    const codeRegex = /^\d{6}$/;
    return codeRegex.test(code);
  },
  
  // 
  getVerificationCode() {
    if (!this.data.phoneNumberValid) {
      wx.showToast({
        title: '',
        icon: 'none'
      });
      return;
    }
    
    // 
    if (this.data.countDown > 0) return;
    
    wx.showLoading({ title: '' });
    
    // 
    const app = getApp();
    wx.request({
      url: `${app.globalData.baseUrl}/api/login/sendVerificationCode`,
      method: 'POST',
      data: {
        phone: this.data.phoneNumber
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          wx.showToast({
            title: '',
            icon: 'success'
          });
          
          // 
          this.startCountDown();
        } else {
          wx.showToast({
            title: res.data.message || '',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('', err);
        wx.hideLoading();
        wx.showToast({
          title: '',
          icon: 'none'
        });
      }
    });
  },
  
  // 
  startCountDown() {
    // 
    this.setData({ countDown: 60 });
    
    // 
    if (this.data.countDownTimer) {
      clearInterval(this.data.countDownTimer);
    }
    
    // 
    const timer = setInterval(() => {
      if (this.data.countDown <= 1) {
        // 
        clearInterval(timer);
        this.setData({ 
          countDown: 0,
          countDownTimer: null
        });
      } else {
        // 
        this.setData({ countDown: this.data.countDown - 1 });
      }
    }, 1000);
    
    // 
    this.setData({ countDownTimer: timer });
  },
  
  // 
  phoneLogin() {
    if (!this.data.phoneNumberValid || !this.data.verificationCodeValid) {
      wx.showToast({
        title: '',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoggingIn: true });
    wx.showLoading({ title: '' });
    
    // 
    const app = getApp();
    wx.request({
      url: `${app.globalData.baseUrl}/api/login/phoneLogin`,
      method: 'GET',
      data: {
        phone: this.data.phoneNumber,
        verificationCode: this.data.verificationCode
      },
      success: (res) => {
        console.log('login success', res);
        wx.hideLoading();
        
        // 
        if (res.statusCode === 200) {
          let token = '';
          
          // 
          if (res.data && res.data.token) {
            // 
            token = res.data.token;
          } else if (res.data && res.data.data && res.data.data.jwtToken) {
            // 
            token = res.data.data.jwtToken;
            
            // 
            if (res.data.data.uid) {
              wx.setStorageSync('uid', res.data.data.uid);
            }
          }
          
          if (token) {
            // 
            app.globalData.token = token;
            app.globalData.isLogin = true;
            wx.setStorageSync('token', token);
            
            console.log('token saved:', token);
            
            // 
            const pages = getCurrentPages();
            if (pages.length > 1) {
              wx.navigateBack();
            } else {
              wx.reLaunch({
                url: '/pages/index/index'
              });
            }
          } else {
            this.setData({ isLoggingIn: false });
            wx.showToast({
              title: '',
              icon: 'none'
            });
          }
        } else {
          this.setData({ isLoggingIn: false });
          wx.showToast({
            title: res.data && res.data.message ? res.data.message : '',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('login fail', err);
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '',
          icon: 'none'
        });
      }
    });
  }
});
