const app = getApp();

Page({
  data: {
    feedbackList: [],
    page: 0, // Spring Boot pagination starts at 0
    pageSize: 10,
    hasMoreData: true,
    isLoading: false
  },

  onLoad: function() {
    this.loadFeedbackList();
  },

  onPullDownRefresh: function() {
    this.setData({
      feedbackList: [],
      page: 0, // Reset to page 0 for Spring Boot pagination
      hasMoreData: true
    });
    this.loadFeedbackList();
  },

  // 加载反馈列表
  loadFeedbackList: function() {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    const header = {
      'content-type': 'application/json',
      'Authorization': wx.getStorageSync('token')
    };

    wx.request({
      url: app.globalData.baseUrl + '/api/feedback',
      method: 'GET',
      header: header,
      data: {
        page: this.data.page,
        size: this.data.pageSize // Spring Boot uses 'size' instead of 'pageSize'
      },
      success: (res) => {
        wx.stopPullDownRefresh();
        console.log('API Response:', res.data);
        
        if (res.data && res.data.success) {
          // Get the paginated data structure
          const paginatedData = res.data.data;
          
          // Extract the feedback items from the content array
          let feedbackItems = [];
          if (paginatedData && paginatedData.content && Array.isArray(paginatedData.content)) {
            feedbackItems = paginatedData.content;
          }
          
          // Format the feedback items
          const formattedList = feedbackItems.map(item => {
            return {
              id: item.id || '',
              title: item.title || '无标题',
              content: item.content || '无内容',
              feedbackType: item.feedbackType || '其他',
              createdAt: item.createdAt ? this.formatDate(new Date(item.createdAt)) : '',
              status: item.status || '待处理'
            };
          });
          
          // Update the feedback list
          const currentList = this.data.feedbackList;
          const updatedList = this.data.page === 0 ? formattedList : currentList.concat(formattedList);
          
          // Check if there are more pages
          const hasMore = paginatedData && !paginatedData.last;
          
          this.setData({
            feedbackList: updatedList,
            hasMoreData: hasMore,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: '获取反馈列表失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (error) => {
        wx.stopPullDownRefresh();
        console.error('获取反馈列表失败:', error);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 加载更多反馈
  loadMoreFeedback: function() {
    if (!this.data.hasMoreData || this.data.isLoading) return;
    
    this.setData({
      page: this.data.page + 1
    });
    
    this.loadFeedbackList();
  },

  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 跳转到反馈详情
  goToFeedbackDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/feedback/feedback-detail/feedback-detail?id=' + id
    });
  },

  // 跳转到新建反馈
  goToNewFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  }
});
