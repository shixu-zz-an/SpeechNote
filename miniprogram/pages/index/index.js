const app = getApp();

Page({
  data: {
    currentVersion: 'free',
    versionDesc: 'u514du8d39u7248u529fu80fduff1a\nu2022 u5b9eu65f6u8bedu97f3u8f6cu5199\nu2022 u672cu5730u5f55u97f3\nu2022 u57fau7840u4f1au8baeu8bb0u5f55',
    banners: [
      {
        id: 1,
        imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&auto=format&fit=crop&q=60',
        title: 'u667au80fdu4f1au8baeu52a9u624b',
        link: '/feature/assistant'
      },
      {
        id: 2,
        imageUrl: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&auto=format&fit=crop&q=60',
        title: 'u9ad8u6548u4f1au8baeu8bb0u5f55',
        link: '/feature/record'
      },
      {
        id: 3,
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=60',
        title: 'AI u4f1au8baeu603bu7ed3',
        link: '/feature/summary'
      }
    ],
    recentMeetings: [
      {
        id: '1',
        title: '2025-03-29 22:52 u5f55u97f3',
        time: '03-29 22:52',
        duration: '00:01',
        source: 'u5c0fu7a0bu5e8f'
      },
      {
        id: '2',
        title: '2025-03-29 22:51 u5f55u97f3',
        time: '03-29 22:51',
        duration: '00:01',
        source: 'u5c0fu7a0bu5e8f'
      }
    ],
    showRecordButton: true,
    isRefreshing: false, // 添加下拉刷新状态
    isLogin: false // 添加登录状态
  },

  onLoad() {
    // u52a0u8f7du6700u8fd1u4f1au8baeu8bb0u5f55
    this.loadRecentMeetings();
  },

  onShow() {
    // 检查并更新登录状态
    const newLoginStatus = this.checkLoginStatus();
    const oldLoginStatus = this.data.isLogin;
    
    this.setData({
      isLogin: newLoginStatus
    });
    
    // 如果登录状态发生变化，重新加载会议记录
    if (newLoginStatus !== oldLoginStatus) {
      console.log('登录状态变化，重新加载会议记录');
      this.loadRecentMeetings();
    }
    
    // u786eu4fddu5728u9996u9875u65f6u663eu793au5f55u97f3u6309u94ae
    const pages = getCurrentPages();
    const isIndexPage = pages.length === 1;
    
    this.setData({
      showRecordButton: isIndexPage
    });

    // u5982u679cu6709u65b0u7684u5f55u97f3uff0cu5237u65b0u5217u8868
    if (app.globalData.needRefreshMeetings) {
      this.loadRecentMeetings();
      app.globalData.needRefreshMeetings = false;
    }
  },

  onHide() {
    // u79bbu5f00u9875u9762u65f6u9690u85cfu5f55u97f3u6309u94ae
    this.setData({
      showRecordButton: false
    });
  },

  // 下拉刷新处理函数
  onPullDownRefresh() {
    console.log('触发下拉刷新');
    this.setData({ isRefreshing: true });
    
    // 重新加载最近会议记录
    this.loadRecentMeetings().then(() => {
      // 完成刷新
      this.setData({ isRefreshing: false });
      console.log('下拉刷新完成');
    }).catch(error => {
      console.error('下拉刷新失败:', error);
      this.setData({ isRefreshing: false });
    });
  },

  // 加载最近会议记录
  async loadRecentMeetings(pageSize = 5, pageNumber = 0) {
    try {
      wx.showLoading({
        title: '加载中...'
      });
      
      console.log('开始请求最近会议记录数据');
      
      // 根据登录状态决定是否需要认证
      const isLogin = this.checkLoginStatus();
      const requestOptions = {
        url: '/api/meetings',
        method: 'GET',
        data: {
          pageSize,
          pageNumber
        }
      };
      
      // 如果未登录，设置noAuth为true以获取公开数据
      if (!isLogin) {
        requestOptions.noAuth = true;
      }
      
      // 调用后端接口获取会议记录
      const res = await app.request(requestOptions);
      
      console.log('获取最近会议记录数据成功:', res);
      
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
          
          // 格式化日期为 MM-DD
          const month = (startTime.getMonth() + 1).toString().padStart(2, '0');
          const day = startTime.getDate().toString().padStart(2, '0');
          const dateStr = `${month}-${day}`;
          
          // 来源映射
          const sourceMap = {
            1: '小程序',
            2: '上传',
            3: '导入'
          };
          
          return {
            id: item.id,
            title: item.title,
            time: `${dateStr} ${timeStr}`,
            duration: durationStr,
            source: sourceMap[item.source] || '未知',
            storagePath: item.storagePath,
            rawSource: item.source, // 添加原始来源值，用于前端图标显示
            rawData: item // 保留原始数据，以备后续使用
          };
        });
        
        console.log('处理后的最近会议记录数据:', meetings);
        
        this.setData({
          recentMeetings: meetings
        });
      } else {
        // 如果没有数据，设置为空数组
        this.setData({
          recentMeetings: []
        });
      }
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载最近会议记录失败:', error);
      wx.hideLoading();
      
      // 如果是需要登录的错误，设置空数组（未登录时的默认状态）
      if (error.message === 'NEED_LOGIN') {
        this.setData({
          recentMeetings: []
        });
        return;
      }
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      
      // 抛出错误，以便在链式调用中处理
      throw error;
    }
  },

  // u5207u6362u7248u672c
  switchVersion(e) {
    const version = e.currentTarget.dataset.version;
    const versionDesc = version === 'free' 
      ? 'u514du8d39u7248u529fu80fduff1a\nu2022 u5b9eu65f6u8bedu97f3u8f6cu5199\nu2022 u672cu5730u5f55u97f3\nu2022 u57fau7840u4f1au8baeu8bb0u5f55'
      : 'u4e13u4e1au7248u529fu80fduff1a\nu2022 u65e0u9650u65f6u957fu5f55u97f3\nu2022 AI u4f1au8baeu7eaau8981\nu2022 u9ad8u7ea7u8f6cu5199u529fu80fd\nu2022 u56e2u961fu534fu4f5c';
    
    this.setData({
      currentVersion: version,
      versionDesc
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp();
    return app.globalData.isLogin;
  },

  // 跳转到登录页
  navigateToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 需要登录的页面跳转
  navigateToWithLogin(path) {
    if (!this.checkLoginStatus()) {
      this.navigateToLogin();
      return;
    }
    
    // 已登录，正常跳转
    wx.navigateTo({
      url: path,
      fail: () => {
        wx.switchTab({
          url: path
        });
      }
    });
  },

  // u9875u9762u5bfcu822a
  navigateTo(e) {
    const path = e.currentTarget.dataset.path;
    
    // 检查是否为需要登录的页面
    const needLoginPaths = [
      '/pages/recording/recording',  // 实时录音
      '/pages/upload/upload'         // 文件上传
    ];
    
    if (needLoginPaths.includes(path)) {
      this.navigateToWithLogin(path);
    } else {
      // 不需要登录的页面直接跳转
      wx.navigateTo({
        url: path,
        fail: () => {
          wx.switchTab({
            url: path
          });
        }
      });
    }
  },

  // u8df3u8f6cu5230u4f1au8baeu8be6u60c5
  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${id}`
    });
  },

  // u8df3u8f6cu5230u4f1au8baeu8bb0u5f55u9875u9762
  navigateToRecords() {
    wx.switchTab({
      url: '/pages/records/records'
    });
  },
  
  // u8df3u8f6cu5230u6211u7684u9875u9762
  navigateToMine() {
    wx.switchTab({
      url: '/pages/mine/mine'
    });
  },

  // u70b9u51fbu8f6eu64adu56fe
  onBannerTap(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.banners[index];
    if (banner.link) {
      wx.navigateTo({
        url: banner.link
      });
    }
  }
});
