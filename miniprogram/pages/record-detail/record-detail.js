const app = getApp();

Page({
  data: {
    meeting: null,
    transcripts: [],
    aiChat: [],
    aiInput: '',
    activeTab: 'transcript', // 'transcript', 'content', 'ai'
    isPlaying: false,
    audioDuration: 0,
    currentPosition: 0,
    playbackRate: 1.0,
    audioContext: null
  },

  onLoad(options) {
    console.log('onLoad options:', options);
    // 初始化页面，获取录音ID
    const id = options.id;
    
    if (!id) {
      console.error('录音ID不存在');
      wx.showToast({
        title: '录音ID不存在',
        icon: 'none'
      });
      
      // 使用模拟数据（仅开发时使用）
      this.loadMockData('mock-id-123');
      
      // 初始化音频播放器
      this.initAudioPlayer();
      return;
    }
    
    // 获取会议记录详情
    this.loadMeetingDetail(id);
    
    // 初始化音频播放器
    this.initAudioPlayer();
  },
  
  onUnload() {
    // 页面卸载时停止音频播放
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
  },

  // 加载会议详情
  async loadMeetingDetail(id) {
    console.log('loadMeetingDetail id:', id);
    try {
      wx.showLoading({
        title: '加载中...'
      });
      
      // 调用后端API获取会议详情
      console.log('开始请求会议详情API');
      const res = await app.request({
        url: `/api/meetings/${id}`,
        method: 'GET'
      });

      console.log('API响应:', res);
      if (res.success && res.data) {
        const meetingData = res.data;
        
        // 处理会议基本信息
        const startTime = new Date(meetingData.startTime);
        const endTime = new Date(meetingData.endTime);
        
        // 计算会议时长（分钟）
        const durationMs = endTime - startTime;
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // 格式化日期
        const month = (startTime.getMonth() + 1).toString().padStart(2, '0');
        const day = startTime.getDate().toString().padStart(2, '0');
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekDay = weekDays[startTime.getDay()];
        const dateStr = `${month}月${day}日 ${weekDay}`;
        
        // 格式化时间
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 来源映射
        const sourceMap = {
          1: '小程序',
          2: '上传',
          3: '导入'
        };
        
        // 构建会议对象
        const meeting = {
          id: meetingData.id,
          title: meetingData.title,
          date: dateStr,
          time: timeStr,
          duration: durationStr,
          source: sourceMap[meetingData.source] || '未知',
          audioUrl: meetingData.storagePath,
          summary: meetingData.summary ? meetingData.summary.split('\n') : []
        };

        // 处理转写内容
        const transcripts = meetingData.transcripts ? meetingData.transcripts.map(item => ({
          speakerId: item.speakerId || '发言人',
          text: item.text,
          timestamp: new Date(item.timestamp).getTime(),
          formattedTime: this.formatTime(new Date(item.timestamp))
        })) : [];

        // 初始化AI聊天
        const aiChat = [
          {
            isAI: true,
            text: '您好，这是会议记录的AI助手。您可以向我询问关于会议内容的问题，我会尽力为您解答。',
            timestamp: new Date().getTime(),
            formattedTime: this.formatTime(new Date())
          }
        ];

        console.log('设置数据:', { meeting, transcripts, aiChat });
        this.setData({ 
          meeting,
          transcripts,
          aiChat,
          audioDuration: durationMinutes * 60 // 转换为秒
        });
      } else {
        throw new Error(res.message || '获取会议详情失败');
      }
      
      wx.hideLoading();
    } catch (error) {
      console.error('加载失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      
      // 使用模拟数据（仅开发时使用）
      console.log('使用模拟数据');
      this.loadMockData(id);
    }
  },
  
  // 加载模拟数据（仅开发时使用）
  loadMockData(id) {
    console.log('loadMockData id:', id);
    const meeting = {
      id: id || 'mock-id-123',
      title: '2025-04-24 录音',
      date: '04月24日 周四',
      time: '14:30',
      duration: '00:30',
      source: '小程序',
      audioUrl: 'https://example.com/audio.mp3',
      summary: [
        '这是一个模拟会议记录',
        '用于开发时测试',
        '请替换为真实数据'
      ]
    };

    const transcripts = [
      {
        speakerId: '张三',
        text: '大家好，这是会议记录的模拟数据。',
        timestamp: new Date().getTime() - 10 * 60000,
        formattedTime: '14:00'
      },
      {
        speakerId: '李四',
        text: '会议中讨论了三个主要问题。',
        timestamp: new Date().getTime() - 5 * 60000,
        formattedTime: '14:15'
      },
      {
        speakerId: '王五',
        text: '会议结束后需要提交会议记录。',
        timestamp: new Date().getTime() - 2 * 60000,
        formattedTime: '14:20'
      }
    ];

    const aiChat = [
      {
        isAI: true,
        text: '您好，这是会议记录的AI助手。您可以向我询问关于会议内容的问题，我会尽力为您解答。',
        timestamp: new Date().getTime(),
        formattedTime: this.formatTime(new Date())
      }
    ];

    console.log('设置模拟数据:', { meeting, transcripts, aiChat });
    
    // 延迟设置数据，模拟网络请求
    setTimeout(() => {
      this.setData({ 
        meeting,
        transcripts,
        aiChat,
        audioDuration: 30 * 60 // 模拟30分钟的音频
      }, () => {
        console.log('模拟数据设置完成，当前数据状态:', this.data);
      });
      
      // 设置音频源
      if (meeting.audioUrl && this.data.audioContext) {
        console.log('设置音频源:', meeting.audioUrl);
        this.data.audioContext.src = meeting.audioUrl;
      }
    }, 100);
  },

  // 初始化音频播放器
  initAudioPlayer() {
    // 创建音频上下文
    const audioContext = wx.createInnerAudioContext();
    
    // 监听播放进度更新
    audioContext.onTimeUpdate(() => {
      this.setData({
        currentPosition: audioContext.currentTime
      });
    });
    
    // 监听播放结束
    audioContext.onEnded(() => {
      this.setData({
        isPlaying: false,
        currentPosition: 0
      });
    });
    
    // 监听播放错误
    audioContext.onError((err) => {
      console.error('音频播放错误:', err);
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
      this.setData({
        isPlaying: false
      });
    });
    
    this.setData({ audioContext });
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  // 音频播放控制
  togglePlayback() {
    const { isPlaying, audioContext, meeting } = this.data;
    
    if (isPlaying) {
      audioContext.pause();
      this.setData({ isPlaying: false });
    } else {
      if (!audioContext.src && meeting.audioUrl) {
        // 判断是本地路径还是远程URL
        const isRemoteUrl = meeting.audioUrl.startsWith('http');
        audioContext.src = isRemoteUrl ? meeting.audioUrl : app.globalData.baseUrl + meeting.audioUrl;
      }
      
      audioContext.play();
      this.setData({ isPlaying: true });
    }
  },

  // 音频定位
  seekAudio(e) {
    const { audioContext } = this.data;
    const position = e.detail.value;
    
    if (audioContext) {
      audioContext.seek(position);
      this.setData({
        currentPosition: position
      });
    }
  },

  // 更改播放速率
  changePlaybackRate() {
    const { audioContext, playbackRate } = this.data;
    let newRate;
    
    // 循环切换速率：1.0 -> 1.5 -> 2.0 -> 0.75 -> 1.0
    switch (playbackRate) {
      case 1.0:
        newRate = 1.5;
        break;
      case 1.5:
        newRate = 2.0;
        break;
      case 2.0:
        newRate = 0.75;
        break;
      default:
        newRate = 1.0;
    }
    
    if (audioContext) {
      audioContext.playbackRate = newRate;
    }
    
    this.setData({
      playbackRate: newRate
    });
  },

  // 向AI发送问题
  sendToAI(e) {
    const query = e.detail.value || this.data.aiInput;
    
    if (!query.trim()) {
      return;
    }
    
    // 添加用户消息
    const userMessage = {
      isAI: false,
      text: query,
      timestamp: new Date().getTime(),
      formattedTime: this.formatTime(new Date())
    };
    
    const aiChat = [...this.data.aiChat, userMessage];
    
    this.setData({
      aiChat,
      aiInput: ''
    });
    
    // 显示加载中
    wx.showLoading({
      title: 'AI思考中...'
    });
    
    // 调用后端AI接口
    app.request({
      url: '/api/ai/chat',
      method: 'POST',
      data: {
        meetingId: this.data.meeting.id,
        query: query
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.success) {
        // 添加AI响应
        const aiMessage = {
          isAI: true,
          text: res.data.response || '抱歉，我无法回答这个问题。',
          timestamp: new Date().getTime(),
          formattedTime: this.formatTime(new Date())
        };
        
        const updatedAiChat = [...this.data.aiChat, aiMessage];
        
        this.setData({
          aiChat: updatedAiChat
        });
      } else {
        this.handleAIError();
      }
    }).catch(error => {
      console.error('AI请求失败:', error);
      wx.hideLoading();
      this.handleAIError();
    });
  },
  
  // 处理AI响应错误
  handleAIError() {
    // 生成模拟响应
    const aiResponse = this.generateAIResponse(this.data.aiChat[this.data.aiChat.length - 1].text);
    
    // 添加AI响应
    const aiMessage = {
      isAI: true,
      text: aiResponse,
      timestamp: new Date().getTime(),
      formattedTime: this.formatTime(new Date())
    };
    
    const updatedAiChat = [...this.data.aiChat, aiMessage];
    
    this.setData({
      aiChat: updatedAiChat
    });
    
    wx.showToast({
      title: '使用本地响应',
      icon: 'none'
    });
  },

  // 搜索录音内容
  searchRecording(e) {
    const query = e.detail.value;
    
    if (!query.trim()) {
      return;
    }
    
    wx.showLoading({
      title: '搜索中...'
    });
    
    // 调用搜索API
    app.request({
      url: '/api/meetings/search',
      method: 'GET',
      data: {
        meetingId: this.data.meeting.id,
        query: query
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.success && res.data && res.data.matches && res.data.matches.length > 0) {
        // 更新转写内容，并高亮匹配文本
        const updatedTranscripts = res.data.matches.map(item => ({
          ...item,
          text: item.text.replace(
            new RegExp(query, 'g'),
            `<span style="color: #3E7BFA;">${query}</span>`
          )
        }));
        
        this.setData({
          activeTab: 'content',
          transcripts: updatedTranscripts
        });
      } else {
        this.handleSearchLocally(query);
      }
    }).catch(error => {
      console.error('搜索失败:', error);
      wx.hideLoading();
      this.handleSearchLocally(query);
    });
  },
  
  // 本地搜索处理
  handleSearchLocally(query) {
    // 在转写内容中搜索
    const { transcripts } = this.data;
    let found = false;
    
    for (let i = 0; i < transcripts.length; i++) {
      if (transcripts[i].text.includes(query)) {
        found = true;
        
        // 创建新的转写数组，并高亮匹配文本
        const updatedTranscripts = [...transcripts];
        updatedTranscripts[i].text = updatedTranscripts[i].text.replace(
          new RegExp(query, 'g'),
          `<span style="color: #3E7BFA;">${query}</span>`
        );
        
        this.setData({
          activeTab: 'content',
          transcripts: updatedTranscripts
        });
        
        break;
      }
    }
    
    if (!found) {
      wx.showToast({
        title: '未找到匹配内容',
        icon: 'none'
      });
    }
  },

  // 分享会议记录
  shareRecording() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 格式化音频时间
  formatTime(seconds) {
    if (typeof seconds === 'object') {
      // 如果是Date对象
      const date = seconds;
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    // 如果是秒数
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // 模拟AI响应生成
  generateAIResponse(query) {
    // 简单的模拟AI响应，实际应用中应该调用后端AI服务
    const responses = [
      "根据会议记录，这次讨论主要关于项目进度和技术难题。",
      "会议中提到了三个主要讨论点：项目进度、技术难题和下一步计划。",
      "发言人张三先开始了会议，然后李四汇报了进展，王五提出了技术难题。",
      "会议提到需要讨论技术难题的解决方案。",
      "抱歉，我在会议记录中没有找到与您问题相关的信息。"
    ];
    
    // 基于查询词简单匹配
    if (query.includes('项目') || query.includes('进度')) {
      return responses[0];
    } else if (query.includes('讨论') || query.includes('主要')) {
      return responses[1];
    } else if (query.includes('发言') || query.includes('张三') || query.includes('李四')) {
      return responses[2];
    } else if (query.includes('技术') || query.includes('难题')) {
      return responses[3];
    } else {
      return responses[4];
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: this.data.meeting.title,
      imageUrl: '/images/share_image.png'
    };
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: this.data.meeting.title,
      path: '/pages/record-detail/record-detail?id=' + this.data.meeting.id,
      imageUrl: '/assets/images/share_image.png'
    };
  }
});
