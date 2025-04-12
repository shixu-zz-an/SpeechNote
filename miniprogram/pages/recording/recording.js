const app = getApp();

// WebSocket配置
const WS_CONFIG = {
  url: 'wss://ai.zjk-net.com/ws',
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
    transcripts: [],
    lastTranscriptId: null,
    formattedDate: '',
    currentTime: '',
    formattedTime: '00:00',
    recordingTime: 0,
    audioBuffer: new Int16Array(),  // 用于存储音频数据
    recordingTitle: '',
    waveformData: Array(30).fill(5),
    needSave: true
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
    
    // 先初始化WebSocket
    this.initWebSocket();
  },

  onUnload() {
    this.stopRecording();
    this.clearTimer();
    this.clearWaveformAnimation();
    this.closeWebSocket();
  },

  // WebSocket连接
  initWebSocket() {
    return new Promise((resolve, reject) => {
      // 创建WebSocket连接
      wx.connectSocket({
        url: 'wss://ai.zjk-net.com/ws',
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
      // 获取当前帧的Int16Array数据
      const frameData = new Int16Array(newAudioData.frameBuffer);
      // console.log('当前帧数据长度:', frameData.length);
      
      let audioBuffer = this.data.audioBuffer || new Int16Array(0);
      // console.log('当前缓冲区长度:', audioBuffer.length);
      
      // 创建新的缓冲区并合并数据
      const newBuffer = new Int16Array(audioBuffer.length + frameData.length);
      if (audioBuffer.length > 0) {
        newBuffer.set(audioBuffer, 0);
      }
      newBuffer.set(frameData, audioBuffer.length);
      
      // console.log('合并后的缓冲区长度:', newBuffer.length);

      // 当缓冲区累积到1024字节或更多时发送数据
      if (newBuffer.length >= 1024) {
        // 截取1024字节发送
        const sendData = newBuffer.slice(0, 1024);
        
        if (this.data.socketStatus === 'connected') {
          console.log('发送数据长度:', sendData.length);
          this.sendWebSocketMessage(sendData.buffer);
        }

        // 保存剩余的数据到缓冲区
        const remainingBuffer = newBuffer.slice(1024);
        console.log('剩余数据长度:', remainingBuffer.length);
        this.setData({
          audioBuffer: remainingBuffer
        });
      } else {
        // 如果数据不足1024字节，保存到缓冲区
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
        this.clearTimer();
        
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

      // 开始录音
      this.recorderManager.start(AUDIO_CONFIG);

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
    if (!this.data.isRecording) return;

    // 更新状态
    this.setData({
      isRecording: false
    });

    // 停止计时
    this.clearTimer();

    // 停止录音
    this.recorderManager.stop();

    // 停止波形动画
    this.stopWaveformAnimation();
  },

  // 切换录音状态
  toggleRecording() {
    const { isRecording } = this.data;
    
    if (isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  // 开始计时器
  startTimer() {
    // 重置录音时间
    this.setData({ 
      recordingTime: 0,
      formattedTime: '0:00'
    });

    this.timer = setInterval(() => {
      const newTime = this.data.recordingTime + 1;
      this.setData({
        recordingTime: newTime,
        formattedTime: this.formatTranscriptTime(newTime)
      });
    }, 1000);
  },

  // 清除计时器
  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 格式化时间戳
  formatTranscriptTime(seconds) {
    if (typeof seconds !== 'number') return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  },

  // 取消录音
  handleCancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消本次录音吗？',
      success: (res) => {
        if (res.confirm) {
          this.stopRecording();
          this.closeWebSocket();
          wx.navigateBack();
        }
      }
    });
  },

  // 完成录音
  handleComplete() {
    this.setData({ needSave: true });
    this.stopRecording();
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
      duration: this.formatTranscriptTime(recordingTime),
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

  // 开始波形动画
  startWaveformAnimation() {
    // 立即更新一次
    this.setData({ waveformData: this.generateWaveformData() });
    
    // 设置定时器持续更新
    this.waveformTimer = setInterval(() => {
      this.setData({ waveformData: this.generateWaveformData() });
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
  closeWebSocket() {
    try {
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

  handleWebSocketMessage(message) {
    try {
      const outerData = JSON.parse(message.data);
      const data = JSON.parse(outerData.transcription);
      
      if (data && data.text) {
        // 使用当前recordingTime作为时间戳
        const currentTime = this.data.recordingTime || 0;
        
        const transcript = {
          id: Date.now(),
          text: data.text,
          isFinal: data.is_final,
          timestamp: currentTime
        };

        const transcripts = [...this.data.transcripts];
        
        // 如果是最终结果，移除对应的临时结果
        if (data.is_final && this.data.lastTranscriptId) {
          const index = transcripts.findIndex(t => t.id === this.data.lastTranscriptId);
          if (index !== -1) {
            transcripts.splice(index, 1);
          }
        }
        
        transcripts.push(transcript);
        
        this.setData({
          transcripts,
          lastTranscriptId: data.is_final ? null : transcript.id
        });

        // 确保滚动到最新消息
        wx.createSelectorQuery()
          .select('.transcription-area')
          .node()
          .exec((res) => {
            const scrollView = res[0];
            if (scrollView && scrollView.scrollTo) {
              scrollView.scrollTo({
                top: 999999,
                behavior: 'smooth'
              });
            }
          });
      }
    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
    }
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
});
