const app = getApp();

Page({
  data: {
    feedback: {},
    id: null
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadFeedbackDetail(options.id);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        this.goToFeedbackList();
      }, 1500);
    }
  },

  // 加载反馈详情
  loadFeedbackDetail: function(id) {
    wx.showLoading({
      title: '加载中...'
    });
    
    const header = {
      'content-type': 'application/json',
      'Authorization': wx.getStorageSync('token')
    };

    wx.request({
      url: app.globalData.baseUrl + '/api/feedback/' + id,
      method: 'GET',
      header: header,
      success: (res) => {
        wx.hideLoading();
        
        if (res.data && res.data.success) {
          let feedbackData = res.data.data;
          
          // Check if feedbackData exists and is an object
          if (!feedbackData || typeof feedbackData !== 'object') {
            wx.showToast({
              title: '数据格式错误',
              icon: 'none',
              duration: 2000
            });
            setTimeout(() => {
              this.goToFeedbackList();
            }, 1500);
            return;
          }
          
          // 格式化日期
          const formattedFeedback = {
            ...feedbackData,
            createdAt: feedbackData.createdAt ? this.formatDateTime(new Date(feedbackData.createdAt)) : '',
            updatedAt: feedbackData.updatedAt ? this.formatDateTime(new Date(feedbackData.updatedAt)) : '',
            repliedAt: feedbackData.repliedAt ? this.formatDateTime(new Date(feedbackData.repliedAt)) : '',
            status: feedbackData.adminReply ? '已回复' : '待处理'
          };
          
          this.setData({
            feedback: formattedFeedback
          });
        } else {
          wx.showToast({
            title: '获取反馈详情失败',
            icon: 'none',
            duration: 2000
          });
          setTimeout(() => {
            this.goToFeedbackList();
          }, 1500);
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('获取反馈详情失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          this.goToFeedbackList();
        }, 1500);
      }
    });
  },

  // 格式化日期时间
  formatDateTime: function(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 跳转到反馈列表
  goToFeedbackList: function() {
    wx.navigateBack();
  },

  // 跳转到新建反馈
  goToNewFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  }
});
