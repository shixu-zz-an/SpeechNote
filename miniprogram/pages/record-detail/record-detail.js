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
    audioContext: null,
    isEditingTitle: false, // 是否正在编辑标题
    editingTitle: '', // 编辑中的标题内容
    lastClickTime: 0 // 用于检测双击
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
      return;
    }
    
    // 获取会议记录详情
    this.loadMeetingDetail(id);
  },
  
  onUnload() {
    // 页面卸载时停止音频播放
    if (this.data.audioContext) {
      this.data.audioContext.stop();
    }
    
    // 清除定时器
    if (this.timeUpdateTimer) {
      clearInterval(this.timeUpdateTimer);
      this.timeUpdateTimer = null;
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
        
        // 检查音频路径是否存在
        const audioUrl = meetingData.storagePath || '';
        console.log('音频路径:', audioUrl);
        
        // 构建会议对象
        const meeting = {
          id: meetingData.id,
          title: meetingData.title,
          date: dateStr,
          time: timeStr,
          duration: durationStr,
          source: sourceMap[meetingData.source] || '未知',
          audioUrl: audioUrl,
          summary: [] // 会议总结将通过单独的API获取
        };

        this.setData({ meeting });
        
        // 获取会议总结和会议原文
        await Promise.all([
          this.loadMeetingSummary(id),
          this.loadMeetingSegments(id)
        ]);

        // 初始化AI聊天
        const aiChat = [
          {
            isAI: true,
            text: '您好，这是会议记录的AI助手。您可以向我询问关于会议内容的问题，我会尽力为您解答。',
            timestamp: new Date().getTime(),
            formattedTime: this.formatTime(new Date())
          }
        ];

        this.setData({ aiChat });
        
        // 在数据加载完成后初始化音频播放器
        this.initAudioPlayer();
        
      } else {
        wx.showToast({
          title: '获取会议详情失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('获取会议详情失败:', error);
      wx.showToast({
        title: '获取会议详情失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 加载会议总结
  async loadMeetingSummary(meetingId) {
    try {
      console.log('开始请求会议总结API');
      const res = await app.request({
        url: `/api/meetings/${meetingId}/summary`,
        method: 'GET'
      });

      console.log('会议总结API响应:', res);
      if (res.success && res.data && res.data.content) {
        // 设置会议总结内容（Markdown格式）
        this.setData({
          'meeting.summaryMarkdown': res.data.content
        });
      } else {
        console.log('会议总结为空或请求失败');
      }
    } catch (error) {
      console.error('获取会议总结失败:', error);
    }
  },
  
  // 加载会议原文（语音片段）
  async loadMeetingSegments(meetingId) {
    try {
      console.log('开始请求会议原文API');
      const res = await app.request({
        url: `/api/meetings/${meetingId}/segments`,
        method: 'GET'
      });
      
      console.log('会议原文API响应:', res);
      if (res.success && res.data && res.data.length > 0) {
        // 处理会议原文数据
        const transcripts = res.data.map(segment => {
          // 计算时间偏移（毫秒转秒）
          const startSeconds = segment.startOffset / 1000;
          
          return {
            id: segment.id,
            speakerId: segment.speaker || '未知',
            text: segment.content || '',
            startOffset: segment.startOffset,
            endOffset: segment.endOffset,
            formattedTime: this.formatTime(startSeconds)
          };
        });
        
        this.setData({ transcripts });
      } else {
        console.log('会议原文为空或请求失败');
        this.setData({ transcripts: [] });
      }
    } catch (error) {
      console.error('获取会议原文失败:', error);
      this.setData({ transcripts: [] });
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
    console.log('初始化音频播放器');
    
    // 检查音频URL是否存在
    if (!this.data.meeting || !this.data.meeting.audioUrl) {
      console.warn('音频URL不存在，无法初始化播放器');
      return;
    }
    
  
    
    // 创建音频上下文
    const audioContext = wx.createInnerAudioContext();
  
  // 使用与 togglePlayback 相同的URL构建逻辑
  const playUrl = app.globalData.baseUrl + '/api/meetings/audio/' + this.data.meeting.id + '?jwtToken=' + app.globalData.token;
  console.log('初始化音频URL:', playUrl);
  
  // 设置音频源
  audioContext.src = playUrl;
  
  // 先设置一个默认的音频时长（可以根据实际情况调整）
  const defaultDuration = 600; // 10分钟，一个合理的默认值
  const formattedDuration = this.formatTime(defaultDuration);
  const formattedCurrentTime = this.formatTime(0);
  
  this.setData({
    audioDuration: defaultDuration,
    formattedDuration: formattedDuration,
    currentPosition: 0,
    formattedCurrentTime: formattedCurrentTime
  });
  
  // 使用两种方法获取音频时长
  // 方法1: onCanplay事件
  audioContext.onCanplay(() => {
    console.log('音频可以播放，当前获取的时长:', audioContext.duration);
    
    // 只有当获取到有效时长时才更新
    if (audioContext.duration && audioContext.duration > 0) {
      this.setData({
        audioDuration: audioContext.duration
      });
    }
  });
  
  // 方法2: 使用onTimeUpdate事件获取时长
  // 在某些情况下，onCanplay事件可能无法获取到正确的时长
    
    // 监听播放进度更新 - 每秒多次触发
    audioContext.onTimeUpdate(() => {
      // 每次更新都强制刷新当前播放位置
      const currentTime = audioContext.currentTime;
      const formattedCurrentTime = this.formatTime(currentTime);
      
      // 使用setData更新UI显示
      this.setData({
        currentPosition: currentTime,
        formattedCurrentTime: formattedCurrentTime // 预格式化的时间字符串
      });
      
      // console.log('当前播放位置更新:', currentTime, formattedCurrentTime);
      
      // 在播放过程中检查并更新音频时长
      if (audioContext.duration && audioContext.duration > 0 && audioContext.duration !== this.data.audioDuration) {
        const duration = audioContext.duration;
        const formattedDuration = this.formatTime(duration);
        console.log('播放中更新音频时长:', duration, formattedDuration);
        
        this.setData({
          audioDuration: duration,
          formattedDuration: formattedDuration // 预格式化的时长字符串
        });
      }
    });
    
    // 添加定时器确保时间显示更新
    this.timeUpdateTimer = setInterval(() => {
      if (this.data.isPlaying && audioContext) {
        const currentTime = audioContext.currentTime;
        const formattedCurrentTime = this.formatTime(currentTime);
        
        this.setData({
          currentPosition: currentTime,
          formattedCurrentTime: formattedCurrentTime
        });
      }
    }, 500); // 每500毫秒强制更新一次
    
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

  // 处理标题点击事件（检测双击）
  handleTitleClick(e) {
    const currentTime = new Date().getTime();
    // 检测是否是双击（两次点击间隔小于300ms）
    if (currentTime - this.data.lastClickTime < 300) {
      this.handleTitleEdit();
    }
    this.setData({
      lastClickTime: currentTime
    });
  },

  // 处理标题编辑
  handleTitleEdit() {
    this.setData({
      isEditingTitle: true,
      editingTitle: this.data.meeting.title
    });
  },

  // 处理标题输入
  handleTitleInput(e) {
    this.setData({
      editingTitle: e.detail.value
    });
  },

  // 处理标题保存
  handleTitleSave() {
    // 如果标题没有变化，直接关闭编辑状态
    if (this.data.editingTitle === this.data.meeting.title) {
      this.setData({
        isEditingTitle: false
      });
      return;
    }

    // 标题不能为空
    if (!this.data.editingTitle.trim()) {
      wx.showToast({
        title: '标题不能为空',
        icon: 'none'
      });
      // 恢复原标题
      this.setData({
        editingTitle: this.data.meeting.title,
        isEditingTitle: false
      });
      return;
    }

    // 更新标题
    this.updateMeetingTitle();
  },

  // 更新会议标题到后端
  updateMeetingTitle() {
    const { meeting, editingTitle } = this.data;
    
    wx.showLoading({
      title: '保存中...'
    });

    app.request({
      url: `/api/meetings/${meeting.id}`,
      method: 'PATCH',
      data: {
        title: editingTitle
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.success) {
        // 更新本地数据
        this.setData({
          'meeting.title': editingTitle,
          isEditingTitle: false
        });
        
        wx.showToast({
          title: '标题已更新',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.message || '更新失败',
          icon: 'none'
        });
        // 恢复原标题
        this.setData({
          isEditingTitle: false
        });
      }
    }).catch(error => {
      console.error('更新标题失败:', error);
      wx.hideLoading();
      
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      });
      
      // 恢复原标题
      this.setData({
        isEditingTitle: false
      });
    });
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
      if (!audioContext.src) {
        // 直接使用指定的URL格式在线播放
        const playUrl = app.globalData.baseUrl + '/api/meetings/audio/' + meeting.id + '?jwtToken=' + app.globalData.token;
        console.log('播放音频URL:', playUrl);
        
        audioContext.src = playUrl;
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
    // 获取输入内容，兼容button点击和键盘提交两种方式
    let query = this.data.aiInput;
    
    if (e && e.detail && e.detail.value) {
      query = e.detail.value;
    }
    
    if (!query || !query.trim()) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none',
        duration: 1500
      });
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
      url: '/api/chat/context',
      method: 'GET',
      data: {
        meetingId: this.data.meeting.id,
        message: query
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
  },
  
  // 处理AI输入变化
  onAIInputChange(e) {
    this.setData({
      aiInput: e.detail.value
    });
  },
  
  // 下载音频文件到本地
  downloadAudio() {
    const { meeting } = this.data;
    if (!meeting || !meeting.id) {
      wx.showToast({
        title: '无法下载音频',
        icon: 'none'
      });
      return;
    }
    
    // 创建下载任务对话框
    wx.showModal({
      title: '下载音频',
      content: `确定下载「${meeting.title}」的音频文件吗？`,
      confirmText: '下载',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.startDownloadWithProgress(meeting.id);
        }
      }
    });
  },
  
  // 显示进度条并下载文件
  startDownloadWithProgress(meetingId) {
    // 使用正确的音频下载URL
    const audioUrl = `${app.globalData.baseUrl}/api/meetings/audio/download/${meetingId}`;
    console.log('下载音频URL:', audioUrl);
    
    // 获取授权令牌
    const token = wx.getStorageSync('jwtToken');
    
    // 创建下载任务
    const downloadTask = wx.downloadFile({
      url: audioUrl,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const tempFilePath = res.tempFilePath;
          // 关闭进度对话框
          wx.hideLoading();
          
          // 弹出保存选项
          this.showSaveOptions(tempFilePath);
        } else {
          wx.hideLoading();
          wx.showToast({
            title: `下载失败: ${res.statusCode}`,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载文件失败', err);
        wx.showToast({
          title: '下载失败: ' + err.errMsg,
          icon: 'none'
        });
      }
    });
    
    // 监听下载进度
    downloadTask.onProgressUpdate((res) => {
      const progress = res.progress;
      // 更新进度提示
      wx.showLoading({
        title: `下载中 ${progress}%`,
        mask: true
      });
      
      console.log('下载进度:', progress);
      console.log('已经下载的数据长度:', res.totalBytesWritten);
      console.log('预期需要下载的数据总长度:', res.totalBytesExpectedToWrite);
    });
  },
  
  // 显示保存选项
  showSaveOptions(tempFilePath) {
    // 获取文件名
    const fileName = `${this.data.meeting.title || '录音'}_${new Date().getTime()}.mp3`;
    
    wx.showActionSheet({
      itemList: ['保存到相册', '保存到微信'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: tempFilePath,
            success: () => {
              wx.showToast({
                title: '已保存到相册',
                icon: 'success'
              });
            },
            fail: (err) => {
              console.error('保存到相册失败', err);
              // 如果失败，尝试使用普通保存
              this.saveFileLocally(tempFilePath);
            }
          });
        } else if (res.tapIndex === 1) {
          // 保存到微信
          wx.saveFile({
            tempFilePath: tempFilePath,
            success: (saveRes) => {
              const savedFilePath = saveRes.savedFilePath;
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
              
              // 询问是否打开文件
              wx.showModal({
                title: '下载成功',
                content: '音频已保存，是否立即打开？',
                confirmText: '打开',
                cancelText: '关闭',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openDocument({
                      filePath: savedFilePath,
                      success: () => {
                        console.log('打开文档成功');
                      },
                      fail: (err) => {
                        console.error('打开文档失败', err);
                        wx.showToast({
                          title: '无法打开此类型文件',
                          icon: 'none'
                        });
                      }
                    });
                  }
                }
              });
            },
            fail: (err) => {
              console.error('保存文件失败', err);
              wx.showToast({
                title: '保存文件失败',
                icon: 'none'
              });
            }
          });
        }
      },
      fail: () => {
        // 如果用户取消了选择，则使用默认保存方式
        this.saveFileLocally(tempFilePath);
      }
    });
  },
  
  // 默认保存方式
  saveFileLocally(tempFilePath) {
    wx.saveFile({
      tempFilePath: tempFilePath,
      success: (saveRes) => {
        const savedFilePath = saveRes.savedFilePath;
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('保存文件失败', err);
        wx.showToast({
          title: '保存文件失败',
          icon: 'none'
        });
      }
    });
  },
});
