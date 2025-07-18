const app = getApp();

Page({
  data: {
    userInfo: {},
    uid: '',
    isVip: false,
    vipTime: '未开通',
    remainingTime: 0,
    remainingWords: 0,
    isLogin: false
  },

  onLoad: function() {
    this.checkLoginStatus();
    this.initUserInfo();
  },

  onShow: function() {
    this.checkLoginStatus();
    this.initUserInfo();
    if (this.data.isLogin) {
      this.refreshVipInfo();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const isLogin = app.globalData.isLogin;
    this.setData({
      isLogin: isLogin
    });
  },

  // 跳转到登录页
  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 初始化用户信息
  initUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const uid = wx.getStorageSync('uid') || '';
    
    this.setData({
      userInfo,
      uid
    });
  },

  // 刷新VIP信息
  refreshVipInfo: function() {
    // 检查登录状态
    if (!this.data.isLogin) {
      return;
    }
    
    app.request({
      url: '/api/user/info',
      method: 'GET'
    }).then(res => {
      if (res) {
        const userInfo = res;
        this.setData({
          isVip: userInfo.hasBuy ? userInfo.hasBuy : false,
          // vipTime: userInfo.hasBuy ? userInfo.expireTime : '未开通',
          remainingTime: userInfo.remainingAmount || 0,
          usageTime: userInfo.usageAmount || 0
        });
      }
    }).catch(error => {
      console.error('获取VIP信息失败:', error);
    });
  },

  // 跳转到VIP购买页面
  goToVipPurchase: function() {
    // 检查登录状态
    if (!this.data.isLogin) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/purchase/purchase'
    });
  },

    // 跳转到日程管理
    goToSchedule: function() {
      // 检查登录状态
      if (!this.data.isLogin) {
        this.goToLogin();
        return;
      }
      
      wx.navigateTo({
        url: '/pages/schedule/schedule'
      });
    },

  // 跳转到设置页面
  goToSettings: function() {
    // 检查登录状态
    if (!this.data.isLogin) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  // 跳转到意见反馈页面
  goToFeedback: function() {
    // 检查登录状态
    if (!this.data.isLogin) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  // 跳转到词库管理
  // goToDictionary: function() {
  //   wx.navigateTo({
  //     url: '/pages/dictionary/dictionary'
  //   });
  // },
  // // 跳转到优惠券
  // goToCoupons: function() {
  //   wx.navigateTo({
  //     url: '/pages/coupons/coupons'
  //   });
  // },

  // // 跳转到活动码兑换
  // goToActivity: function() {
  //   wx.navigateTo({
  //     url: '/pages/activity/activity'
  //   });
  // },

  // // 跳转到浏览记录
  // goToHistory: function() {
  //   wx.navigateTo({
  //     url: '/pages/history/history'
  //   });
  // },

  goToMySubscription() {
    // 检查登录状态
    if (!this.data.isLogin) {
      this.goToLogin();
      return;
    }
    
    wx.navigateTo({
      url: '/pages/mysubscription/mysubscription'
    })
  },
}); 