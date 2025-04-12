const app = getApp();

Page({
  data: {
    currentVersion: 'free',
    versionDesc: '免费版功能：\n• 实时语音转写\n• 本地录音\n• 基础会议记录',
    banners: [
      {
        id: 1,
        imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&auto=format&fit=crop&q=60',
        title: '智能会议助手',
        link: '/feature/assistant'
      },
      {
        id: 2,
        imageUrl: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&auto=format&fit=crop&q=60',
        title: '高效会议记录',
        link: '/feature/record'
      },
      {
        id: 3,
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop&q=60',
        title: 'AI 会议总结',
        link: '/feature/summary'
      }
    ],
    recentMeetings: [
      {
        id: '1',
        title: '2025-03-29 22:52 录音',
        time: '03-29 22:52',
        duration: '00:01',
        source: '小程序'
      },
      {
        id: '2',
        title: '2025-03-29 22:51 录音',
        time: '03-29 22:51',
        duration: '00:01',
        source: '小程序'
      }
    ],
    showRecordButton: true
  },

  onLoad() {
    this.loadRecentMeetings();
  },

  onShow() {
    // 确保在首页时显示录音按钮
    const pages = getCurrentPages();
    const isIndexPage = pages.length === 1;
    
    this.setData({
      showRecordButton: isIndexPage
    });

    // 如果有新的录音，刷新列表
    if (app.globalData.needRefreshMeetings) {
      this.loadRecentMeetings();
      app.globalData.needRefreshMeetings = false;
    }
  },

  onHide() {
    // 离开页面时隐藏录音按钮
    this.setData({
      showRecordButton: false
    });
  },

  // 加载最近会议记录
  async loadRecentMeetings() {
    try {
      // 这里替换为实际的API调用
      // const res = await app.request({
      //   url: '/api/meetings/recent',
      //   method: 'GET'
      // });
      // this.setData({
      //   recentMeetings: res.data
      // });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 切换版本
  switchVersion(e) {
    const version = e.currentTarget.dataset.version;
    const versionDesc = version === 'free' 
      ? '免费版功能：\n• 实时语音转写\n• 本地录音\n• 基础会议记录'
      : '专业版功能：\n• 无限时长录音\n• AI 会议纪要\n• 高级转写功能\n• 团队协作';
    
    this.setData({
      currentVersion: version,
      versionDesc
    });
  },

  // 页面导航
  navigateTo(e) {
    const path = e.currentTarget.dataset.path;
    wx.navigateTo({
      url: path,
      fail: () => {
        wx.switchTab({
          url: path
        });
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

  // 点击轮播图
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
