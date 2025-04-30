// pages/login/login.js
Page({
  data: {
    canIUseGetUserProfile: false,
    userInfo: null,
    hasUserInfo: false,
    isLoggingIn: false
  },

  onLoad() {
    // 判断是否可以使用 wx.getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },

  // 单一授权登录流程
  authorizeAndLogin() {
    if (this.data.isLoggingIn) return; // 阻止重复点击
    
    this.setData({ isLoggingIn: true });
    
    // 先获取用户信息
    wx.showModal({
      title: '授权提示',
      content: '为了完善会员资料，需要获取您的头像和昵称信息，是否允许？',
      confirmText: '允许',
      cancelText: '拒绝',
      success: (res) => {
        if (res.confirm) {
          // 用户允许授权，使用getUserProfile
          this.getUserProfileInfo();
        } else {
          // 用户拒绝授权，直接进行登录
          console.log('用户拒绝授权信息');
          this.setData({ isLoggingIn: false });
          this.wxLogin();
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
      }
    });
  },

  // 获取用户信息
  getUserProfileInfo() {
    if (this.data.canIUseGetUserProfile) {
      wx.getUserProfile({
        desc: '用于完善会员资料', // 声明获取用户信息后的用途
        success: (res) => {
          console.log('getUserProfile success', res);
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          });
          // 保存用户信息
          getApp().globalData.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          
          // 获取到用户信息后，进行微信登录
          this.wxLogin();
        },
        fail: (err) => {
          console.error('getUserProfile fail', err);
          // 即使获取用户信息失败，也尝试进行登录
          this.setData({ isLoggingIn: false });
          wx.showToast({
            title: '授权失败',
            icon: 'none',
            complete: () => {
              // 延迟1.5秒后进行登录
              setTimeout(() => {
                this.wxLogin();
              }, 1500);
            }
          });
        }
      });
    } else {
      // 旧版兼容，直接使用getUserInfo
      wx.getUserInfo({
        success: (res) => {
          console.log('getUserInfo success', res);
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          });
          // 保存用户信息
          getApp().globalData.userInfo = res.userInfo;
          wx.setStorageSync('userInfo', res.userInfo);
          
          // 获取到用户信息后，进行微信登录
          this.wxLogin();
        },
        fail: (err) => {
          console.error('getUserInfo fail', err);
          // 即使获取用户信息失败，也尝试进行登录
          this.wxLogin();
        }
      });
    }
  },

  // 处理手机号授权结果
  getPhoneNumber(e) {
    if (e.detail.code) {
      // 新版接口返回临时登录凭证 code
      this.setData({
        phoneCode: e.detail.code
      });
      
      // 获取到手机号凭证后，进行微信登录
      this.wxLogin();
    } else {
      console.error('获取手机号失败', e.detail.errMsg);
      // 获取手机号失败，仍然尝试登录
      this.wxLogin();
    }
  },

  // 微信登录
  wxLogin() {
    wx.showLoading({
      title: '登录中...',
    });

    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用后端登录接口
          this.serverLogin(res.code);
        } else {
          this.setData({ isLoggingIn: false });
          wx.hideLoading();
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
  },

  // 调用后端登录接口
  serverLogin(code) {
    const app = getApp();
    
    // 准备发送给后端的数据
    const data = { code };
    console.log(this.data.userInfo);
    console.log(this.data.hasUserInfo);


    // 如果有用户信息，添加到请求数据中
    if (this.data.hasUserInfo && this.data.userInfo) {
      data.nickname = this.data.userInfo.nickName || '';
      data.avatarUrl = this.data.userInfo.avatarUrl || '';
      data.gender = this.data.userInfo.gender || 0;
      data.country = this.data.userInfo.country || '';
      data.province = this.data.userInfo.province || '';
      data.city = this.data.userInfo.city || '';
    }
    
    // 如果有手机号凭证，添加到请求数据中
    if (this.data.phoneCode) {
      data.phoneCode = this.data.phoneCode;
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
          // 保存 token
          const token = res.data.data.jwtToken;
          app.globalData.token = token;
          app.globalData.isLogin = true;
          wx.setStorageSync('token', token);
          
          // 如果返回了用户 ID，保存起来
          if (res.data.data.uid) {
            wx.setStorageSync('uid', res.data.data.uid);
          }
          
          console.log('token saved:', token);
          
          // 返回上一页或首页
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            // 使用 reLaunch 代替 switchTab，因为首页是 tabBar 页面
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        } else {
          wx.showToast({
            title: res.data.message || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        this.setData({ isLoggingIn: false });
        wx.hideLoading();
        wx.showToast({
          title: '服务器连接失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 直接登录（跳过授权）
  skipAuthLogin() {
    if (this.data.isLoggingIn) return; // 阻止重复点击
    this.setData({ isLoggingIn: true });
    this.wxLogin();
  }
});
