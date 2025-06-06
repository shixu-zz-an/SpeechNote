// pages/settings/settings.ts
const app = getApp();

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    version: '1.0.0'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadUserInfo();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadUserInfo();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.performLogout();
        }
      }
    });
  },

  // 执行退出登录操作
  async performLogout() {
    try {
      wx.showLoading({
        title: '正在退出...'
      });

      // 调用后端退出接口（如果需要）
      try {
        await app.request({
          url: '/api/login/logout',
          method: 'POST',
          noAuth: false // 需要携带token
        });
      } catch (error) {
        console.log('后端退出接口调用失败，继续本地退出:', error);
      }

      // 清除本地存储的登录信息
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('uid');

      // 更新全局状态
      app.globalData.token = '';
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;

      wx.hideLoading();

      wx.showToast({
        title: '退出成功',
        icon: 'success',
        duration: 1500
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        // 跳转到首页并刷新
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);

    } catch (error) {
      wx.hideLoading();
      console.error('退出登录失败:', error);
      wx.showToast({
        title: '退出失败，请重试',
        icon: 'none'
      });
    }
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除应用缓存吗？这将删除本地存储的临时数据。',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除缓存但保留登录信息
            const token = wx.getStorageSync('token');
            const userInfo = wx.getStorageSync('userInfo');
            const uid = wx.getStorageSync('uid');
            
            wx.clearStorageSync();
            
            // 恢复登录信息
            if (token) wx.setStorageSync('token', token);
            if (userInfo) wx.setStorageSync('userInfo', userInfo);
            if (uid) wx.setStorageSync('uid', uid);
            
            wx.showToast({
              title: '缓存清除成功',
              icon: 'success'
            });
          } catch (error) {
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 关于我们
  aboutUs() {
    wx.showModal({
      title: '关于语音笔记',
      content: `版本：${this.data.version}\n\n语音笔记是一款智能会议记录应用，支持实时语音转写、AI总结等功能。`,
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 联系客服
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题，请添加客服微信或发送邮件至客服邮箱。',
      showCancel: false,
      confirmText: '确定'
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
})