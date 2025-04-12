const app = getApp();

Page({
  data: {
    meeting: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0
  },

  onLoad(options) {
    const { id } = options;
    this.loadMeetingDetail(id);
  },

  // 加载会议详情
  async loadMeetingDetail(id) {
    try {
      // 这里替换为实际的API调用
      // const res = await app.request({
      //   url: `/api/meetings/${id}`,
      //   method: 'GET'
      // });

      // 使用模拟数据
      const meeting = {
        id,
        title: '2025-03-29 22:52 录音',
        time: '22:52',
        duration: '00:01',
        source: '小程序',
        content: [
          {
            speaker: '张三',
            time: '00:00',
            text: '大家好，今天我们讨论一下项目进度。'
          },
          {
            speaker: '李四',
            time: '00:15',
            text: '好的，我先汇报一下我这边的进展。'
          },
          {
            speaker: '王五',
            time: '00:30',
            text: '我这边遇到了一些技术难题，需要讨论一下解决方案。'
          }
        ]
      };

      this.setData({ meeting });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 返回上一页
  handleBack() {
    wx.navigateBack();
  },

  // 编辑会议内容
  handleEdit() {
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none'
    });
  },

  // 分享会议记录
  handleShare() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 播放录音
  handlePlay() {
    const { isPlaying } = this.data;
    if (isPlaying) {
      this.stopAudio();
    } else {
      this.playAudio();
    }
  },

  // 播放音频
  async playAudio() {
    try {
      // 这里替换为实际的音频URL
      const audioUrl = 'https://example.com/audio.mp3';
      
      const audioContext = wx.createInnerAudioContext();
      audioContext.src = audioUrl;
      audioContext.play();
      
      audioContext.onPlay(() => {
        this.setData({ isPlaying: true });
      });

      audioContext.onEnded(() => {
        this.setData({ isPlaying: false });
      });

      audioContext.onError(() => {
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        });
        this.setData({ isPlaying: false });
      });

      this.audioContext = audioContext;
    } catch (error) {
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
    }
  },

  // 停止播放
  stopAudio() {
    if (this.audioContext) {
      this.audioContext.stop();
      this.setData({ isPlaying: false });
    }
  },

  // 生成并下载摘要
  handleSummary() {
    wx.showLoading({
      title: '正在生成摘要'
    });

    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '会议摘要',
        content: '1. 项目进度讨论\n2. 技术难题探讨\n3. 下一步计划制定',
        showCancel: false
      });
    }, 1500);
  },

  // 下载录音文件
  handleDownload() {
    wx.showLoading({
      title: '准备下载'
    });

    // 这里替换为实际的下载逻辑
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      });
    }, 1500);
  },

  // 删除会议记录
  handleDelete() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条会议记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 这里替换为实际的删除API调用
            // await app.request({
            //   url: `/api/meetings/${this.data.meeting.id}`,
            //   method: 'DELETE'
            // });

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });

            // 返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  onShareAppMessage() {
    const { meeting } = this.data;
    return {
      title: meeting.title,
      path: `/pages/record-detail/record-detail?id=${meeting.id}`
    };
  },

  onShareTimeline() {
    const { meeting } = this.data;
    return {
      title: meeting.title,
      query: `id=${meeting.id}`
    };
  }
});
