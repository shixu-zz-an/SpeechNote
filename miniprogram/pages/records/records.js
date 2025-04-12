const app = getApp();

Page({
  data: {
    meetings: [],
    meetingGroups: []
  },

  onLoad() {
    this.loadMeetings();
  },

  onShow() {
    if (app.globalData.needRefreshMeetings) {
      this.loadMeetings();
      app.globalData.needRefreshMeetings = false;
    }
  },

  onPullDownRefresh() {
    this.loadMeetings().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载会议记录
  async loadMeetings() {
    try {
      // 这里替换为实际的API调用
      // const res = await app.request({
      //   url: '/api/meetings',
      //   method: 'GET'
      // });
      
      // 使用模拟数据
      const meetings = [
        {
          id: '1',
          title: '2025-03-29 22:52 录音',
          time: '22:52',
          duration: '00:01',
          source: '小程序',
          date: '2025-03-29'
        },
        {
          id: '2',
          title: '2025-03-29 22:51 录音',
          time: '22:51',
          duration: '00:01',
          source: '小程序',
          date: '2025-03-29'
        }
      ];

      // 按日期分组
      const groups = this.groupMeetingsByDate(meetings);
      
      this.setData({
        meetings,
        meetingGroups: groups
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 按日期对会议记录进行分组
  groupMeetingsByDate(meetings) {
    const groups = {};
    meetings.forEach(meeting => {
      const date = meeting.date;
      if (!groups[date]) {
        groups[date] = {
          date: this.formatDate(date),
          meetings: []
        };
      }
      groups[date].meetings.push(meeting);
    });

    return Object.values(groups).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
  },

  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    return `${month}月${day}日 周${weekDay}`;
  },

  // 跳转到搜索页面
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 显示筛选选项
  showFilter() {
    wx.showActionSheet({
      itemList: ['全部记录', '仅显示已转写', '按时间排序', '按时长排序'],
      success: (res) => {
        // 处理筛选逻辑
      }
    });
  },

  // 跳转到会议详情
  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${id}`
    });
  },

  // 跳转到录音页面
  navigateToRecording() {
    wx.navigateTo({
      url: '/pages/recording/recording'
    });
  }
});
