// pages/login/login.js
Page({
  data: {
    canIUseGetUserProfile: false,
    userInfo: null,
    hasUserInfo: false
  },

  onLoad() {
    // 判断是否可以使用 wx.getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });
        // 保存用户信息
        getApp().globalData.userInfo = res.userInfo;
        wx.setStorageSync('userInfo', res.userInfo);
        
        // 获取用户信息后，进行微信登录
        this.wxLogin();
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        // 即使获取用户信息失败，也尝试进行登录
        this.wxLogin();
      }
    });
  },

  // 兼容旧版获取用户信息的方法
  getUserInfo(e) {
    if (e.detail.userInfo) {
      this.setData({
        userInfo: e.detail.userInfo,
        hasUserInfo: true
      });
      // 保存用户信息
      getApp().globalData.userInfo = e.detail.userInfo;
      wx.setStorageSync('userInfo', e.detail.userInfo);
      
      // 获取用户信息后，进行微信登录
      this.wxLogin();
    } else {
      console.error('用户拒绝授权');
      // 用户拒绝授权，也尝试进行登录
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
          wx.hideLoading();
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
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
    wx.request({
      url: 'http://192.168.0.100:8080/api/wx/login',
      method: 'GET',
      data: { code },
      success: (res) => {
        console.log(res);
        wx.hideLoading();
        if (res.statusCode === 200 && res.data && res.data.data && res.data.data.jwtToken) {
          // 保存token
          const token = res.data.data.jwtToken;
          app.globalData.token = token;
          app.globalData.isLogin = true;
          wx.setStorageSync('token', token);
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
        wx.hideLoading();
        wx.showToast({
          title: '服务器连接失败',
          icon: 'none'
        });
      }
    });
  }
});
