const app = getApp();

Page({
  data: {
    meetings: [],
    meetingGroups: []
  },

  onLoad() {
    console.log('records onLoad');
    this.loadMeetings();
  },

  onShow() {
    console.log('records onShow');
    // Tab 页面切换时也需要加载数据
    this.loadMeetings();
    
    if (app.globalData.needRefreshMeetings) {
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
      wx.showLoading({
        title: '加载中...'
      });
      
      console.log('开始请求会议记录数据');
      // 调用后端接口获取会议记录
      const res = await app.request({
        url: '/api/meetings',
        method: 'GET'
      });
      
      console.log('获取会议记录数据成功:', res);
      
      if (res.success && res.data) {
        // 处理后端返回的数据
        const meetings = res.data.map(item => {
          // 从startTime中提取日期和时间
          const startTime = new Date(item.startTime);
          const endTime = new Date(item.endTime);
          
          // 计算会议时长（分钟）
          const durationMs = endTime - startTime;
          const durationMinutes = Math.floor(durationMs / (1000 * 60));
          const hours = Math.floor(durationMinutes / 60);
          const minutes = durationMinutes % 60;
          const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          
          // 格式化时间为 HH:MM
          const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
          
          // 格式化日期为 YYYY-MM-DD
          const dateStr = startTime.toISOString().split('T')[0];
          
          // 来源映射
          const sourceMap = {
            1: '小程序',
            2: '上传',
            3: '导入'
          };
          
          return {
            id: item.id,
            title: item.title,
            time: timeStr,
            duration: durationStr,
            source: sourceMap[item.source] || '未知',
            date: dateStr,
            recordingStatus: item.recordingStatus,
            storagePath: item.storagePath,
            rawData: item // 保留原始数据，以备后续使用
          };
        });

        // 按日期分组
        const groups = this.groupMeetingsByDate(meetings);
        
        console.log('处理后的会议记录数据:', meetings);
        console.log('分组后的数据:', groups);
        
        this.setData({
          meetings,
          meetingGroups: groups
        });
      } else {
        throw new Error(res.message || '获取会议记录失败');
      }
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载会议记录失败:', error);
      wx.hideLoading();
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
      return new Date(b.date.replace(/[年月日]/g, '-').replace('周', '').trim()) - 
             new Date(a.date.replace(/[年月日]/g, '-').replace('周', '').trim());
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
