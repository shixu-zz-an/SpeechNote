const app = getApp();

Page({
  data: {
    currentTab: 'package', // package 或 single
    selectedPackage: '', // 
    selectedSingle: '', //  
    totalPrice: 0,
    plans: [],
    itemId: 0,
  },

  onLoad: function() {
    // 默认选中月卡
    this.selectPackage({ currentTarget: { dataset: { package: 'month' } } });
    // 获取套餐计划
    this.fetchPlans([1, 2]);
  },

  // 获取计划列表
  fetchPlans: function(planTypes) {
    wx.request({
      url: app.globalData.httpBaseUrl + '/api/subscription/plans',
      method: 'GET',
      data: {
        planTypes: planTypes
      },
      header: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: (res) => {
        if (res.data) {
          this.setData({
            plans: res.data
          });
        } else {
          wx.showToast({
            title: '获取计划列表失败',
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

    // 根据标签获取不同的计划列表
    if (tab === 'package') {
      this.fetchPlans([1, 2]);
    } else {
      this.fetchPlans([3]);
    }
  },

  // 选择套餐
  selectPackage: function(e) {
    const packageItem = e.currentTarget.dataset.package;
    const selectedPlan = this.data.plans.find(plan => plan.id === packageItem);
    this.setData({
      selectedPackage: packageItem,
      selectedSingle: '',
      totalPrice: selectedPlan ? selectedPlan.price : 0,
      itemId: packageItem ? packageItem : 0
    });
  },

  // 选择单独购买
  selectSingle: function(e) {
    const type = e.currentTarget.dataset.type;
    const selectedPlan = this.data.plans.find(plan => plan.id === type);
    this.setData({
      selectedSingle: type,
      selectedPackage: '',
      totalPrice: selectedPlan ? selectedPlan.price : 0,
      itemId: type ? type : 0
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
      url: app.globalData.httpBaseUrl + '/api/order/create',
      method: 'POST',
      data: {
        type: this.data.currentTab,
        package: selectedType,
        amount: this.data.totalPrice,
        planId: this.data.itemId,
        deviceType:1
      },
      header: {
        'content-type': 'application/json',
        'Authorization': 'Bearer ' + wx.getStorageSync('token')
      },
      success: (res) => {
        if (res.data ) {
          const payParams = res.data;
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