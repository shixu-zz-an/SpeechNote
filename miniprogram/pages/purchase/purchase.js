const app = getApp();

Page({
  data: {
    currentTab: 'package', // package 或 single
    selectedPackage: '', // 3days, month, season, year
    selectedSingle: '', // 10h, 30h, 100h
    totalPrice: 0,
    prices: {
      '3days': 29,
      'month': 29,
      'season': 69,
      'year': 99,
      '10h': 29,
      '30h': 69,
      '100h': 199
    }
  },

  onLoad: function() {
    // 默认选中月卡
    this.selectPackage({ currentTarget: { dataset: { package: 'month' } } });
  },

  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      selectedPackage: '',
      selectedSingle: '',
      totalPrice: 0
    });
  },

  // 选择套餐
  selectPackage: function(e) {
    const package = e.currentTarget.dataset.package;
    this.setData({
      selectedPackage: package,
      selectedSingle: '',
      totalPrice: this.data.prices[package]
    });
  },

  // 选择单独购买
  selectSingle: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedSingle: type,
      selectedPackage: '',
      totalPrice: this.data.prices[type]
    });
  },

  // 获取优惠券
  getCoupon: function() {
    wx.showToast({
      title: '领取成功',
      icon: 'success'
    });
  },

  // 立即购买
  purchase: function() {
    const selectedType = this.data.currentTab === 'package' ? this.data.selectedPackage : this.data.selectedSingle;
    
    if (!selectedType) {
      wx.showToast({
        title: '请选择购买套餐',
        icon: 'none'
      });
      return;
    }

    // 调用支付接口
    wx.request({
      url: app.globalData.httpBaseUrl + '/order/create',
      method: 'POST',
      data: {
        type: this.data.currentTab,
        package: selectedType,
        amount: this.data.totalPrice
      },
      header: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: (res) => {
        if (res.data && res.data.code === 0) {
          const payParams = res.data.data;
          // 调起微信支付
          wx.requestPayment({
            ...payParams,
            success: () => {
              wx.showToast({
                title: '支付成功',
                icon: 'success'
              });
              // 支付成功后返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            },
            fail: (error) => {
              console.error('支付失败:', error);
              wx.showToast({
                title: '支付失败',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '创建订单失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('请求失败:', error);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  }
}); 