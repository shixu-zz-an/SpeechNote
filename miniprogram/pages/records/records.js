const app = getApp();

Page({
  data: {
    meetings: [],
    meetingGroups: [],
    searchQuery: '',
    originalMeetings: [], // 存储原始会议数据，用于搜索后恢复
    pageNumber: 0,
    pageSize: 10,
    isLoading: false,
    hasReachedEnd: false,
    isRefreshing: false, // 下拉刷新状态
    isDeleting: false, // 删除状态
    startX: 0, // 触摸开始位置
    moveX: 0  // 触摸移动位置
  },

  onLoad() {
    console.log('records onLoad');
    this.loadMeetings();
  },

  onShow() {
    console.log('records onShow');
    // Tab 页面切换时也需要加载数据
    // 如果需要刷新会议列表
    if (app.globalData.needRefreshMeetings) {
      // 重置分页数据
      this.setData({
        pageNumber: 0,
        meetings: [],
        meetingGroups: [],
        originalMeetings: [],
        hasReachedEnd: false
      });
      this.loadMeetings();
      app.globalData.needRefreshMeetings = false;
    }
  },

  // 原有的下拉刷新函数（微信原生下拉刷新）
  onPullDownRefresh() {
    this.refreshMeetings().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 新增的自定义下拉刷新函数（scroll-view 的刷新）
  onRefresh() {
    this.setData({ isRefreshing: true });
    this.refreshMeetings().then(() => {
      this.setData({ isRefreshing: false });
    }).catch(() => {
      this.setData({ isRefreshing: false });
    });
  },

  // 刷新会议列表（获取最新数据）
  async refreshMeetings() {
    console.log('刷新会议列表，获取最新数据');
    
    // 重置分页数据
    this.setData({
      pageNumber: 0,
      meetings: [],
      meetingGroups: [],
      originalMeetings: [],
      hasReachedEnd: false
    });
    
    // 加载最新数据
    return this.loadMeetings();
  },

  // 加载会议记录
  async loadMeetings() {
    // 如果正在加载或已经加载完毕，不再发起请求
    if (this.data.isLoading || this.data.hasReachedEnd) {
      return;
    }
    
    let loadingShown = false;
    
    try {
      this.setData({ isLoading: true });
      
      if (this.data.pageNumber === 0) {
        wx.showLoading({
          title: '加载中...'
        });
        loadingShown = true;
      }

      console.log(`开始请求会议记录数据，页码: ${this.data.pageNumber}, 每页数量: ${this.data.pageSize}`);
      // 调用后端接口获取会议记录，增加分页参数
      const res = await app.request({
        url: '/api/meetings',
        method: 'GET',
        data: {
          pageNumber: this.data.pageNumber,
          pageSize: this.data.pageSize
        }
      });

      console.log('会议记录数据:', res);

      if (res.success && res.data) {
        // 处理会议数据
        const processedMeetings = this.processMeetings(res.data);
        
        // 检查是否已经加载完所有数据
        if (processedMeetings.length === 0) {
          this.setData({ hasReachedEnd: true });
        } else {
          // 合并现有数据和新数据
          const allMeetings = [...this.data.meetings, ...processedMeetings];
          
          // 按日期分组
          const groupedMeetings = this.groupMeetingsByDate(allMeetings);
          
          this.setData({
            meetings: allMeetings,
            meetingGroups: groupedMeetings,
            originalMeetings: allMeetings, // 保存原始数据
            pageNumber: this.data.pageNumber + 1 // 增加页码
          });
        }
      } else {
        throw new Error(res.message || '获取会议记录失败');
      }
      
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      throw error; // 向上传递错误，以便在链式调用中处理
    } finally {
      this.setData({ isLoading: false });
      if (loadingShown) {
        wx.hideLoading();
      }
    }
  },

  // 滚动到底部时加载更多数据
  loadMoreMeetings() {
    console.log('滚动到底部，加载更多数据');
    this.loadMeetings();
  },

  // 处理会议数据
  processMeetings(meetings) {
    return meetings.map(item => {
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
        rawData: item, // 保留原始数据，以备后续使用
        showDelete: false // 是否显示删除按钮
      };
    });
  },

  // 处理搜索输入
  onSearchInput(e) {
    this.setData({
      searchQuery: e.detail.value
    });
    
    // 如果清空了搜索框，恢复原始数据
    if (!e.detail.value) {
      this.resetSearch();
    }
  },
  
  // 执行搜索
  searchMeetings(e) {
    const query = e.detail.value.trim();
    if (!query) {
      this.resetSearch();
      return;
    }
    
    // 在本地会议数据中搜索
    this.performLocalSearch(query);
  },
  
  // 执行本地搜索
  performLocalSearch(query) {
    const { originalMeetings } = this.data;
    
    // 如果没有原始数据，不执行搜索
    if (!originalMeetings || originalMeetings.length === 0) {
      return;
    }
    
    // 在标题中搜索关键词
    const filteredMeetings = originalMeetings.filter(meeting => 
      meeting.title.toLowerCase().includes(query.toLowerCase())
    );
    
    // 更新UI
    const groupedMeetings = this.groupMeetingsByDate(filteredMeetings);
    
    this.setData({
      meetings: filteredMeetings,
      meetingGroups: groupedMeetings,
      hasReachedEnd: true // 搜索模式下不需要加载更多
    });
    
    // 显示搜索结果数量
    wx.showToast({
      title: `找到 ${filteredMeetings.length} 条记录`,
      icon: 'none'
    });
  },
  
  // 重置搜索
  resetSearch() {
    const { originalMeetings } = this.data;
    
    // 恢复原始数据
    const groupedMeetings = this.groupMeetingsByDate(originalMeetings);
    
    this.setData({
      meetings: originalMeetings,
      meetingGroups: groupedMeetings,
      searchQuery: '',
      hasReachedEnd: false // 重置搜索后可以继续加载更多
    });
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
  },

  // 触摸开始
  touchStart(e) {
    this.setData({
      startX: e.touches[0].clientX
    });
  },
  
  // 触摸移动
  touchMove(e) {
    const moveX = e.touches[0].clientX;
    const distance = moveX - this.data.startX;
    
    // 如果向左滑动
    if (distance < 0) {
      this.setData({
        moveX: distance
      });
    }
  },
  
  // 触摸结束
  touchEnd(e) {
    const { id, index, groupIndex } = e.currentTarget.dataset;
    const distance = this.data.moveX;
    
    console.log('Touch end distance:', distance);
    
    // 如果滑动距离超过一定阈值，显示删除按钮
    if (distance < -50) {
      // 更新当前会议的showDelete状态
      const meetingGroups = [...this.data.meetingGroups];
      meetingGroups[groupIndex].meetings[index].showDelete = true;
      
      this.setData({
        meetingGroups: meetingGroups
      });
    } else {
      // 如果滑动距离不超过一定阈值，隐藏删除按钮
      const meetingGroups = [...this.data.meetingGroups];
      if (meetingGroups[groupIndex].meetings[index].showDelete) {
        meetingGroups[groupIndex].meetings[index].showDelete = false;
        
        this.setData({
          meetingGroups: meetingGroups
        });
      }
    }
    
    // 重置触摸移动位置
    this.setData({
      moveX: 0
    });
  },
  
  // 删除会议
  async deleteMeeting(e) {
    const { id } = e.currentTarget.dataset;
    console.log('Delete meeting:', id);
    
    try {
      // 确认删除
      const confirmResult = await new Promise((resolve, reject) => {
        wx.showModal({
          title: '确认删除',
          content: '确认删除该会议记录？',
          confirmText: '删除',
          confirmColor: '#ff4d4f',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              resolve(true);
            } else {
              resolve(false);
            }
          },
          fail: reject
        });
      });
      
      if (!confirmResult) return;
      
      wx.showLoading({ title: '删除中...' });
      
      // 调用删除会议记录的 API
      const res = await app.request({
        url: `/api/meetings/${id}`,
        method: 'DELETE'
      });
      
      if (res.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 刷新会议列表
        this.refreshMeetings();
      } else {
        throw new Error(res.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
