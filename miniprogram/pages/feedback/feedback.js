const app = getApp();

Page({
  data: {
    feedbackTypes: ['功能建议', '使用问题', '内容相关', '其他'],
    selectedType: '功能建议',
    title: '',
    content: '',
    contactInfo: '',
    isFormValid: false
  },

  onLoad: function() {
    // 初始化页面
  },

  // 选择反馈类型
  selectType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type
    });
    this.validateForm();
  },

  // 标题输入
  onTitleInput: function(e) {
    this.setData({
      title: e.detail.value
    });
    this.validateForm();
  },

  // 内容输入
  onContentInput: function(e) {
    this.setData({
      content: e.detail.value
    });
    this.validateForm();
  },

  // 联系方式输入
  onContactInput: function(e) {
    this.setData({
      contactInfo: e.detail.value
    });
  },

  // 验证表单
  validateForm: function() {
    const { title, content } = this.data;
    const isValid = title.trim() !== '' && content.trim() !== '';
    
    this.setData({
      isFormValid: isValid
    });
  },

  // 提交反馈
  submitFeedback: function() {
    const { selectedType, title, content, contactInfo } = this.data;
    
    if (!this.data.isFormValid) {
      return;
    }

    wx.showLoading({
      title: '提交中...'
    });

    // 构建请求数据
    const feedbackData = {
      title: title,
      content: content,
      contactInfo: contactInfo,
      feedbackType: selectedType
    };

    // 发送请求到后端
    wx.request({
      url: app.globalData.baseUrl + '/api/feedback',
      method: 'POST',
      header: {
        'content-type': 'application/json',
        'Authorization': wx.getStorageSync('token')
      },
      data: feedbackData,
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.success) {
          wx.showToast({
            title: '反馈提交成功',
            icon: 'success',
            duration: 2000
          });
          
          // 清空表单
          this.setData({
            title: '',
            content: '',
            contactInfo: '',
            selectedType: '功能建议',
            isFormValid: false
          });
          
          // 延迟跳转到反馈列表
          setTimeout(() => {
            this.goToFeedbackList();
          }, 1500);
        } else {
          wx.showToast({
            title: '提交失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('提交反馈失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到反馈历史列表
  goToFeedbackList: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback-list/feedback-list'
    });
  }
});
