const app = getApp();

// WebSocket配置
const WS_CONFIG = {
  url: app.globalData.wsUrl + '/api/ws/recording',
  reconnectInterval: 30000,
  maxRetries: 3
};

// 音频配置
const AUDIO_CONFIG = {
  duration: 600000,  // 最长录音时长，单位：ms
  sampleRate: 16000,  // 目标采样率
  numberOfChannels: 1,  // 录音通道数
  encodeBitRate: 48000,  // 编码码率
  format: 'PCM',  // 音频格式
  frameSize: 1,  // 帧大小
  needFrame: true  // 启用帧录制
};

// 缓冲区大小
const CHUNK_SIZE = 1024;  // 每次发送的数据块大小

Page({
  data: {
    isRecording: false,
    socketStatus: '', // closed, connecting, connected
    recordingId: '',
    transcripts: [],
    lastTranscriptId: null,
    formattedDate: '',
    currentTime: '',
    formattedTime: '00:00',
    recordingTime: 0,
    audioBuffer: new Int16Array(),  // 用于存储音频数据
    recordingTitle: '',
    waveformData: Array(30).fill(5),
    needSave: true,
    currentLanguage: '中文',
    maxDuration: '10:00',
    progressPercent: 0
  },

  // 格式化时间显示
  formatTranscriptTime(seconds) {
    if (typeof seconds !== 'number') return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  },

  // 格式化时间戳
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onLoad() {
    this.updateDateTime();
    // 每秒更新时间
    setInterval(() => {
      this.updateDateTime();
    }, 1000);

    // 初始化日期和标题
    const now = new Date();
    const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const recordingTitle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 录音`;

    this.setData({
      formattedDate,
      recordingTitle
    });

    // 启动波形动画
    this.startWaveformAnimation();
    
    // 初始化WebSocket并开始录音
    this.initAndStartRecording();
  },

  onUnload() {
    this.stopRecording();
    this.stopTimer();
    this.stopWaveformAnimation();
    this.closeWebSocket();
  },

  // WebSocket连接
  initWebSocket() {
    return new Promise((resolve, reject) => {
      // 创建WebSocket连接
      wx.connectSocket({
        url: WS_CONFIG.url,
        success: () => {
          console.log('WebSocket连接创建成功');
        },
        fail: (error) => {
          console.error('WebSocket连接创建失败:', error);
          reject(error);
        }
      });

      // 监听WebSocket连接打开
      wx.onSocketOpen(() => {
        console.log('WebSocket连接已打开');
        this.setData({ socketStatus: 'connected' });
        
        // 发送初始化消息
        this.sendWebSocketMessage({
          command: 'START_RECORDING',
          config: {
            sampleRate: AUDIO_CONFIG.sampleRate,
            channels: AUDIO_CONFIG.numberOfChannels,
            frameSize: AUDIO_CONFIG.frameSize
          }
        });
        
        resolve();
      });

      // 监听WebSocket错误
      wx.onSocketError((error) => {
        console.error('WebSocket错误:', error);
        this.setData({ socketStatus: 'error' });
        reject(error);
      });

      // 监听WebSocket关闭
      wx.onSocketClose(() => {
        console.log('WebSocket连接已关闭');
        this.setData({ socketStatus: 'closed' });
      });

      // 监听WebSocket消息
      wx.onSocketMessage((res) => {
        this.handleWebSocketMessage(res);
      });
    });
  },

  // 将Float32Array转换为Int16Array
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // 将float32 [-1.0, 1.0]转换为int16 [-32768, 32767]
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  },

  resampleAudio(audioData, sourceRate, targetRate) {
    if (sourceRate === targetRate) {
        return audioData;
    }

    const ratio = sourceRate / targetRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;

        if (index >= audioData.length - 1) {
            result[i] = audioData[audioData.length - 1];
        } else {
            result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
        }
    }

    return result;
  },

  // 处理并发送音频数据块
  processAudioChunks(newAudioData) {
    try {
      // 只有在录音状态下才处理音频数据
      if (!this.data.isRecording) {
        console.log('当前未在录音状态，跳过音频处理');
        return;
      }

      // 获取当前帧的Int16Array数据
      const frameData = new Int16Array(newAudioData.frameBuffer);
      console.log('收到音频帧数据，长度:', frameData.length);
      
      // 更新波形数据
      this.updateWaveform(frameData);
      
      let audioBuffer = this.data.audioBuffer || new Int16Array(0);
      
      // 创建新的缓冲区并合并数据
      const newBuffer = new Int16Array(audioBuffer.length + frameData.length);
      if (audioBuffer.length > 0) {
        newBuffer.set(audioBuffer, 0);
      }
      newBuffer.set(frameData, audioBuffer.length);

      // 当缓冲区累积到足够大小时发送数据
      if (newBuffer.length >= 1920) {
        // 截取数据发送
        const sendData = newBuffer.slice(0, 1920);
        
        if (this.data.socketStatus === 'connected') {
          console.log('发送音频数据，大小:', sendData.length);
          this.sendWebSocketMessage(sendData.buffer);
        } else {
          console.log('WebSocket未连接，无法发送音频数据');
        }

        // 保存剩余的数据到缓冲区
        const remainingBuffer = newBuffer.slice(1920);
        this.setData({
          audioBuffer: remainingBuffer
        });
      } else {
        // 如果数据不足，保存到缓冲区
        this.setData({
          audioBuffer: newBuffer
        });
      }
    } catch (error) {
      console.error('处理音频数据块失败:', error);
      console.error('错误详情:', error.stack);
    }
  },

  // 初始化录音管理器
  initRecorder() {
    return new Promise((resolve, reject) => {
      if (this.data.socketStatus !== 'connected') {
        reject(new Error('WebSocket未连接'));
        return;
      }
      wx.authorize({scope: "scope.record"});

      const recorderManager = wx.getRecorderManager();

      recorderManager.onStart(() => {
        console.log('录音开始');
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array()  // 重置音频缓冲区
        });
        this.startTimer();

        // 发送开始录音命令
        this.sendWebSocketMessage({
          command: 'START_RECORDING',
          config: {
            sampleRate: AUDIO_CONFIG.sampleRate,
            channels: AUDIO_CONFIG.numberOfChannels,
            frameSize: AUDIO_CONFIG.frameSize
          }
        });
      });

      recorderManager.onFrameRecorded((res) => {
        if (this.data.socketStatus === 'connected' && res.frameBuffer) {
          try {
            // 直接传递帧数据对象
            this.processAudioChunks(res);
          } catch (error) {
            console.error('处理音频帧数据失败:', error);
          }
        }
      });

      recorderManager.onStop(() => {
        console.log('录音结束');
        this.setData({ isRecording: false });
        this.stopTimer();
        
        // 发送剩余的音频数据
        if (this.data.audioBuffer.length > 0) {
          this.sendWebSocketMessage(this.data.audioBuffer.buffer);
        }
        
        this.closeWebSocket();
      });

      recorderManager.onError((error) => {
        console.error('录音错误:', error);
        wx.showToast({
          title: '录音出错，请重试',
          icon: 'none'
        });
        this.setData({ isRecording: false });
        this.closeWebSocket();
        reject(error);
      });

      this.recorderManager = recorderManager;
      resolve(recorderManager);
    });
  },

  // 开始录音
  async startRecording() {
    if (this.data.isRecording) return;

    try {
      // 确保WebSocket已连接
      if (this.data.socketStatus !== 'connected') {
        await this.initWebSocket();
      }

      // 初始化录音
      await this.initRecorder();

      // 更新状态
      this.setData({
        isRecording: true,
        transcripts: [],
        recordingTime: 0,
        formattedTime: '0:00',
        audioBuffer: new Int16Array()
      });

      // 开始计时
      this.startTimer();

      // 开始波形动画
      this.startWaveformAnimation();

    } catch (error) {
      console.error('开始录音失败:', error);
      wx.showToast({
        title: '启动录音失败',
        icon: 'none'
      });
    }
  },

  // 停止录音
  stopRecording() {
    if (!this.recorderManager || !this.data.isRecording) return;

    try {
      this.recorderManager.stop();
      this.stopTimer();
      this.setData({
        isRecording: false
      });

      // 发送停止信号到服务器
      // if (this.data.socketStatus === 'connected') {
      //   this.sendWebSocketMessage({
      //     command: 'STOP_RECORDING',
      //     recordingId: this.data.recordingId
      //   });
      // }
    } catch (error) {
      console.error('停止录音失败:', error);
    }
  },

  // 切换录音状态
  async toggleRecording() {
    if (this.data.isRecording) {
      this.pauseRecording();
    } else {
      await this.resumeRecording();
    }
  },

  // 暂停录音
  pauseRecording() {
    if (!this.recorderManager || !this.data.isRecording) return;

    try {
      // 暂停录音管理器
      this.recorderManager.pause();
      
      // 暂停计时器
      this.pauseTimer();
      
      // 更新状态
      this.setData({
        isRecording: false
      });

      // 发送暂停信号到服务器，但保持WebSocket连接
      // if (this.data.socketStatus === 'connected') {
      //   this.sendWebSocketMessage({
      //     command: 'PAUSE_RECORDING',
      //     recordingId: this.data.recordingId
      //   });
      // }

      // 停止波形动画
      this.stopWaveformAnimation();

      wx.showToast({
        title: '录音已暂停',
        icon: 'none'
      });
    } catch (error) {
      console.error('暂停录音失败:', error);
      wx.showToast({
        title: '暂停录音失败',
        icon: 'none'
      });
    }
  },

  // 恢复录音
  async resumeRecording() {
    if (!this.recorderManager || this.data.isRecording) return;

    try {
      // 确保WebSocket连接
      if (this.data.socketStatus !== 'connected') {
        await this.initWebSocket();
      }

      // 恢复录音管理器
      this.recorderManager.resume();
      
      // 恢复计时器
      this.resumeTimer();
      
      // 更新状态
      this.setData({
        isRecording: true
      });

      // 发送恢复信号到服务器
      // if (this.data.socketStatus === 'connected') {
      //   this.sendWebSocketMessage({
      //     command: 'RESUME_RECORDING',
      //     recordingId: this.data.recordingId
      //   });
      // }

      // 恢复波形动画
      this.startWaveformAnimation();

      wx.showToast({
        title: '录音已恢复',
        icon: 'none'
      });
    } catch (error) {
      console.error('恢复录音失败:', error);
      wx.showToast({
        title: '恢复录音失败',
        icon: 'none'
      });
    }
  },

  // 暂停计时器
  pauseTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 恢复计时器
  resumeTimer() {
    if (!this.timer) {
      this.startTimer();
    }
  },

  // 开始计时器
  startTimer() {
    // 重置录音时间
    this.setData({ 
      recordingTime: 0,
      formattedTime: '00:00'
    });

    this.timer = setInterval(() => {
      const newTime = this.data.recordingTime + 1;
      const formattedTime = this.formatDuration(newTime);
      
      this.setData({
        recordingTime: newTime,
        formattedTime: formattedTime
      });
      this.updateProgress();
    }, 1000);
  },

  // 停止计时器
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 取消录音
  onCancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消本次录音吗？录音内容将不会被保存。',
      success: (res) => {
        if (res.confirm) {
          if (this.data.socketStatus === 'connected') {
            console.log("cancel data ====",this.data)
            this.sendWebSocketMessage({
              command: 'CANCEL_RECORDING',
              recordId: this.data.recordingId
            });
          }
          this.stopRecording();
          this.closeWebSocket(false);
          wx.navigateBack();
        }
      }
    });
  },

  // 完成录音
  onComplete() {
    // 移除录音状态检查，允许在暂停状态下完成
    wx.showModal({
      title: '确认完成',
      content: '确定要结束本次录音吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ needSave: true });
          
          // 如果正在录音，先停止录音
          if (this.data.isRecording) {
            this.stopRecording();
          }
          
          // 等待最后的数据处理完成
          setTimeout(() => {
            this.handleSave();
          }, 1000);
        }
      }
    });
  },

  // 保存录音
  handleSave() {
    const { recordingTime, recordingTitle, transcripts, recordingId } = this.data;

    if (!recordingId) {
      wx.showToast({
        title: '录音ID无效',
        icon: 'none'
      });
      return;
    }

    // 创建新的会议记录
    const newMeeting = {
      id: recordingId,
      title: recordingTitle,
      time: this.data.formattedDate.split(' ')[1],
      duration: this.formatDuration(recordingTime),
      source: '小程序',
      content: transcripts
    };

    // 保存会议记录
    try {
      // 这里替换为实际的API调用
      // await app.request({
      //   url: '/api/meetings',
      //   method: 'POST',
      //   data: newMeeting
      // });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 通知其他页面刷新
      app.globalData.needRefreshMeetings = true;

      // 跳转到会议详情页
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/record-detail/record-detail?id=${newMeeting.id}`
        });
      }, 1500);
    } catch (error) {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      wx.navigateBack();
    }
  },

  // 生成波形数据
  generateWaveformData() {
    const { isRecording } = this.data;
    return Array.from({ length: 30 }, () => 
      Math.floor(Math.random() * 20 + (isRecording ? 30 : 5))
    );
  },

  // 更新波形显示
  updateWaveform(frameData) {
    try {
      // 计算音量强度（使用音频数据的平均绝对值）
      let sum = 0;
      const len = frameData.length;
      
      // 取样计算平均振幅
      for (let i = 0; i < len; i += 10) {
        sum += Math.abs(frameData[i]);
      }
      
      const avgAmplitude = sum / (len / 10);
      
      // 将振幅转换为显示高度（2-80范围内）
      const normalizedHeight = Math.max(2, Math.min(80, (avgAmplitude / 32767) * 100));
      
      // 生成波形数据
      const waveformData = [...this.data.waveformData];
      waveformData.shift();
      waveformData.push(normalizedHeight);
      
      this.setData({
        waveformData: waveformData
      });
    } catch (error) {
      console.error('更新波形显示失败:', error);
    }
  },

  // 开始波形动画
  startWaveformAnimation() {
    // 立即更新一次
    this.setData({ waveformData: Array(30).fill(5) });
    
    // 设置定时器持续更新
    this.waveformTimer = setInterval(() => {
      // 生成随机波形数据
      const waveformData = Array(30).fill(0).map(() => 
        Math.floor(Math.random() * 20 + 30)
      );
      this.setData({ waveformData });
    }, 100);
  },

  // 停止波形动画
  stopWaveformAnimation() {
    if (this.waveformTimer) {
      clearInterval(this.waveformTimer);
      this.waveformTimer = null;
    }
    // 重置波形高度
    this.setData({ waveformData: Array(30).fill(5) });
  },

  // 发送WebSocket消息
  sendWebSocketMessage(message) {
    if (this.data.socketStatus !== 'connected') {
      console.error('WebSocket未连接');
      return false;
    }

    try {
      // 如果是ArrayBuffer，直接发送二进制数据
      if (message instanceof ArrayBuffer) {
        wx.sendSocketMessage({
          data: message,
          success: () => {
            console.log('音频数据发送成功，大小:', message.byteLength);
            return true;
          },
          fail: (error) => {
            console.error('音频数据发送失败:', error);
            this.handleWebSocketError(error);
            return false;
          }
        });
      } else {
        // 其他消息（如控制命令）转为JSON发送
        wx.sendSocketMessage({
          data: JSON.stringify(message),
          success: () => {
            console.log('消息发送成功:', message);
            return true;
          },
          fail: (error) => {
            console.error('消息发送失败:', error);
            this.handleWebSocketError(error);
            return false;
          }
        });
      }
    } catch (error) {
      console.error('发送消息时出错:', error);
      this.handleWebSocketError(error);
      return false;
    }
  },

  // 关闭WebSocket连接
  closeWebSocket(isNeedSendStop=true) {
    try {
      // 发送停止录音命令
      if (this.data.socketStatus === 'connected') {
        if(isNeedSendStop){
            this.sendWebSocketMessage({
              command: 'STOP_RECORDING',
              recordId: this.data.recordingId
            });
        }
      }

      // 关闭WebSocket连接
      wx.closeSocket({
        code: 1000,
        reason: 'User closed the recording'
      });
    } catch (error) {
      console.error('关闭WebSocket连接失败:', error);
    }
    
    this.setData({ 
      socketStatus: 'closed',
      socketRetryCount: 0
    });
  },

  // 处理WebSocket错误
  handleWebSocketError(error) {
    console.error('WebSocket错误:', error);
    
    this.setData({ 
      socketStatus: 'closed'
    });

    // 显示错误提示
    wx.showToast({
      title: '网络连接异常，请检查网络设置',
      icon: 'none',
      duration: 2000
    });
  },

  handleWebSocketMessage(res) {
    try {
      const data = JSON.parse(res.data);
      
      // 处理服务器返回的消息
      switch (data.type) {
        case 'START_RECORDING':
          // 服务器返回录音ID和初始化状态
          this.setData({
            recordingId: data.recordId
          });
          console.log("handle data ====",this.data)
          break;
        
        case 'TRANSCRIPTION':
          // 处理转写结果
          this.handleTranscription(data);
          break;
        
        case 'error':
          // 处理错误
          console.error('服务器错误:', data.message);
          wx.showToast({
            title: '服务器错误: ' + data.message,
            icon: 'none'
          });
          break;
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error);
    }
  },

  handleTranscription(data) {
    // 处理转写结果
    const { text, timestamp=Date.now(), speakerId="speaker" } = data;

    if (!text || text.trim() === '') {
      return;
    }
    
    // 格式化时间戳
    const date = new Date(timestamp);
    const formattedTime = this.formatTime(date);

    // 添加到转写结果列表
    const transcripts = this.data.transcripts;
    
    // 检查是否已存在该时间戳的转写，如果存在则更新
    const existingIndex = transcripts.findIndex(item => 
      Math.abs(new Date(item.timestamp).getTime() - timestamp) < 1000
    );
    
    if (existingIndex >= 0) {
      // 更新现有的转写
      transcripts[existingIndex].text = text;
      transcripts[existingIndex].speakerId = speakerId;
    } else {
      // 添加新的转写
      transcripts.push({
        text,
        timestamp,
        formattedTime,
        speakerId
      });
      
      // 按时间戳排序
      transcripts.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // 更新数据
    this.setData({
      transcripts: transcripts
    }, () => {
      // 在数据更新后执行滚动
      this.scrollToBottom();
    });
  },

  // 滚动到底部
  scrollToBottom() {
    // 使用选择器获取滚动视图
    const query = wx.createSelectorQuery();
    query.select('.transcription-area').boundingClientRect();
    query.select('.transcription-content').boundingClientRect();
    query.exec((res) => {
      if (res[0] && res[1]) {
        const scrollView = res[0];
        const content = res[1];
        if (scrollView && content) {
          // 计算需要滚动的距离
          const scrollDistance = content.height - scrollView.height;
          if (scrollDistance > 0) {
            wx.pageScrollTo({
              scrollTop: scrollDistance,
              duration: 300
            });
          }
        }
      }
    });
  },

  updateDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    this.setData({
      formattedDate: `${year}-${month}-${day}`,
      currentTime: `${hours}:${minutes}`,
      recordingTitle: `${year}-${month}-${day} ${hours}:${minutes} 录音`
    });
  },

  // 初始化并开始录音
  async initAndStartRecording() {
    try {
      // 初始化WebSocket
      await this.initWebSocket();
      
      // 初始化录音管理器
      const recorderManager = wx.getRecorderManager();
      
      // 监听录音开始事件
      recorderManager.onStart(() => {
        console.log('录音开始');
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array()  // 重置音频缓冲区
        });
        this.startTimer();
      });

      // 监听录音帧数据事件
      recorderManager.onFrameRecorded((res) => {
        if (this.data.socketStatus === 'connected' && res.frameBuffer) {
          try {
            // 直接传递帧数据对象
            this.processAudioChunks(res);
          } catch (error) {
            console.error('处理音频帧数据失败:', error);
          }
        }
      });

      // 监听录音停止事件
      recorderManager.onStop(() => {
        console.log('录音结束');
        this.setData({ isRecording: false });
        this.stopTimer();
        
        // 发送剩余的音频数据
        if (this.data.audioBuffer.length > 0) {
          this.sendWebSocketMessage(this.data.audioBuffer.buffer);
        }
        
        this.closeWebSocket();
      });

      // 监听录音错误事件
      recorderManager.onError((error) => {
        console.error('录音错误:', error);
        wx.showToast({
          title: '录音出错，请重试',
          icon: 'none'
        });
        this.setData({ isRecording: false });
        this.closeWebSocket();
      });

      this.recorderManager = recorderManager;

      // 开始录音
      console.log('开始录音...');
      recorderManager.start({
        duration: AUDIO_CONFIG.duration,
        sampleRate: AUDIO_CONFIG.sampleRate,
        numberOfChannels: AUDIO_CONFIG.numberOfChannels,
        encodeBitRate: AUDIO_CONFIG.encodeBitRate,
        format: AUDIO_CONFIG.format,
        frameSize: AUDIO_CONFIG.frameSize,
        needFrame: AUDIO_CONFIG.needFrame
      });

    } catch (error) {
      console.error('初始化录音失败:', error);
      wx.showToast({
        title: '启动录音失败',
        icon: 'none'
      });
    }
  },

  // 更新进度条
  updateProgress() {
    const progress = (this.data.recordingTime / 600) * 100; // 600秒 = 10分钟
    this.setData({
      progressPercent: Math.min(progress, 100)
    });
  },

  // 格式化时长
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },
});
