const app = getApp();

Page({
  data: {
    userInfo: {},
    uid: '',
    isVip: false,
    vipTime: '未开通',
    remainingTime: 0,
    remainingWords: 0
  },

  onLoad: function() {
    this.initUserInfo();
  },

  onShow: function() {
    this.refreshVipInfo();
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
    const header = {
      'content-type': 'application/json',
      'Authorization': 'Bearer ' + wx.getStorageSync('token')
    };

    wx.request({
      url: app.globalData.httpBaseUrl + '/user/info',
      method: 'GET',
      header: header,
      success: (res) => {
        if (res.data && res.data.code === 0) {
          const vipInfo = res.data.data;
          this.setData({
            isVip: vipInfo.isVip,
            vipTime: vipInfo.isVip ? vipInfo.expireTime : '未开通',
            remainingTime: vipInfo.remainingTime || 0,
            remainingWords: vipInfo.remainingWords || 0
          });
        }
      },
      fail: (error) => {
        console.error('获取VIP信息失败:', error);
      }
    });
  },

  // 跳转到VIP购买页面
  goToVipPurchase: function() {
    wx.navigateTo({
      url: '/pages/purchase/purchase'
    });
  },

    // 跳转到日程管理
    goToSchedule: function() {
      wx.navigateTo({
        url: '/pages/schedule/schedule'
      });
    },

  // 跳转到设置页面
  goToSettings: function() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  },

  // // 跳转到词库管理
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
  // }
}); 