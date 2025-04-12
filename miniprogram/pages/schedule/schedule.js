const app = getApp();

Page({
  data: {
    selectedDate: '',
    defaultTime: new Date().getTime(),
    spots: [],
    schedules: []
  },

  onLoad() {
    this.setCurrentDate();
    this.loadSchedules();
  },

  // 设置当前日期
  setCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    
    this.setData({
      selectedDate: `${year}年${month}月${day}日 周${weekDay}`,
      defaultTime: now.getTime()
    });
  },

  // 加载日程数据
  async loadSchedules() {
    try {
      // 这里替换为实际的API调用
      // const res = await app.request({
      //   url: '/api/schedules',
      //   method: 'GET'
      // });

      // 使用模拟数据
      const schedules = [
        {
          id: '1',
          title: '项目周会',
          startTime: '09:30',
          duration: '1小时',
          participants: ['张三', '李四', '王五'],
          location: '会议室A',
          status: 'upcoming'
        },
        {
          id: '2',
          title: '产品评审会',
          startTime: '14:00',
          duration: '2小时',
          participants: ['张三', '李四'],
          location: '线上会议',
          status: 'completed'
        }
      ];

      // 生成日历打点数据
      const spots = this.generateSpots();

      this.setData({
        schedules,
        spots
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 生成日历打点数据
  generateSpots() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    // 这里应该根据实际数据生成打点
    return [
      {
        year,
        month,
        day: now.getDate()
      },
      {
        year,
        month,
        day: now.getDate() + 2
      }
    ];
  },

  // 点击日历日期
  onDayClick(e) {
    const { year, month, day } = e.detail;
    const date = new Date(year, month - 1, day);
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    this.setData({
      selectedDate: `${year}年${month}月${day}日 周${weekDay}`
    });

    this.loadSchedules();
  },

  // 月份变化
  onMonthChange(e) {
    const { year, month } = e.detail;
    // 加载该月的日程数据，更新打点信息
    this.loadSchedules();
  },

  // 显示筛选选项
  showFilter() {
    wx.showActionSheet({
      itemList: ['全部日程', '未开始', '已完成', '已取消'],
      success: (res) => {
        // 处理筛选逻辑
      }
    });
  },

  // 添加日程
  addSchedule() {
    wx.showToast({
      title: '添加日程功能开发中',
      icon: 'none'
    });
  },

  // 查看日程详情
  viewScheduleDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '日程详情功能开发中',
      icon: 'none'
    });
  },

  // 跳转到录音页面
  navigateToRecording() {
    wx.navigateTo({
      url: '/pages/recording/recording'
    });
  }
});
