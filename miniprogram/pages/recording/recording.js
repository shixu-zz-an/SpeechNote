const app = getApp();

// WebSocket配置
const WS_CONFIG = {
  url: app.globalData.wsUrl + '/api/ws/recording',
  reconnectInterval: 30000,
  maxRetries: 3
};

// 音频配置
const AUDIO_CONFIG = {
  duration: 600000,  // 单次录音时长，单位：ms (10分钟，微信限制)
  sampleRate: 16000,  // 目标采样率
  numberOfChannels: 1,  // 录音通道数
  encodeBitRate: 48000,  // 编码码率
  format: 'PCM',  // 音频格式
  frameSize: 1,  // 帧大小
  needFrame: true  // 启用帧录制
};

// 分段录音配置
const SEGMENT_CONFIG = {
  maxDuration: 10800000,  // 总录音时长，单位：ms (3小时)
  segmentDuration: 600000,  // 每段录音时长，单位：ms (10分钟)
  overlapTime: 2000,  // 重叠时间，单位：ms (2秒，确保无缝连接)
  autoRestart: true  // 自动重启录音
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
    scrollToView: '', // 用于自动滚动到指定元素
    formattedDate: '',
    currentTime: '',
    formattedTime: '00:00',
    recordingTime: 0,
    audioBuffer: new Int16Array(),  // 用于存储音频数据
    recordingTitle: '',
    waveformData: Array(30).fill(5),
    needSave: true,
    currentLanguage: '中文',
    maxDuration: '03:00:00',
    progressPercent: 0,
    fadeIn: {}, // 用于添加淡入动画
    
    // 分段录音相关状态
    segmentIndex: 0,  // 当前录音段索引
    totalRecordingTime: 0,  // 总录音时间（累计所有段）
    isSegmentTransitioning: false,  // 是否正在切换录音段
    segmentStartTime: 0,  // 当前段开始时间
    lastSegmentEndTime: 0,  // 上一段结束时间
    shouldContinueRecording: true,  // 是否应该继续录音
    isFirstSegment: true,  // 是否是第一段录音
    
    // 调试相关
    debugMode: true  // 开启调试模式
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
    // 开启屏幕常亮
    this.setKeepScreenOn(true);
    
    this.updateDateTime();
    // 每秒更新时间
    this.dateTimeTimer = setInterval(() => {
      this.updateDateTime();
    }, 1000);

    // 初始化日期和标题
    const now = new Date();
    const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const recordingTitle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} 录音`;

    // 创建淡入动画
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease',
    });
    animation.opacity(1).step();

    this.setData({
      formattedDate,
      recordingTitle,
      fadeIn: animation.export()
    });

    // 启动波形动画
    this.startWaveformAnimation();
    
    // 初始化WebSocket并开始录音
    this.initAndStartRecording();
  },

  onShow() {
    // 页面显示时开启屏幕常亮
    this.setKeepScreenOn(true);
  },

  onHide() {
    // 页面隐藏时关闭屏幕常亮
    this.setKeepScreenOn(false);
  },

  onUnload() {
    // 关闭屏幕常亮
    this.setKeepScreenOn(false);
    
    this.stopRecording();
    this.stopTimer();
    this.stopWaveformAnimation();
    this.stopRecordingMonitor(); // 停止录音监控
    this.closeWebSocket();
    
    // 清理时间更新定时器
    if (this.dateTimeTimer) {
      clearInterval(this.dateTimeTimer);
      this.dateTimeTimer = null;
    }
    
    // 移除WebSocket事件监听器
    if (this.onSocketOpenHandler) {
      wx.offSocketOpen(this.onSocketOpenHandler);
    }
    if (this.onSocketErrorHandler) {
      wx.offSocketError(this.onSocketErrorHandler);
    }
    if (this.onSocketCloseHandler) {
      wx.offSocketClose(this.onSocketCloseHandler);
    }
    if (this.onSocketMessageHandler) {
      wx.offSocketMessage(this.onSocketMessageHandler);
    }
  },

  // 设置屏幕常亮状态
  setKeepScreenOn(keepScreenOn) {
    wx.setKeepScreenOn({
      keepScreenOn: keepScreenOn,
      success: () => {
        console.log(`屏幕常亮${keepScreenOn ? '开启' : '关闭'}成功`);
      },
      fail: (error) => {
        console.error(`屏幕常亮${keepScreenOn ? '开启' : '关闭'}失败:`, error);
      }
    });
  },

  // WebSocket连接
  initWebSocket() {
    return new Promise((resolve, reject) => {
      const app = getApp();
      const token = app.globalData.token;
      
      // 检查是否有token
      if (!token) {
        console.error('WebSocket连接失败: 未找到JWT令牌');
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        reject(new Error('未找到JWT令牌'));
        return;
      }
      
      // 构建WebSocket URL，添加token参数
      let wsUrl = WS_CONFIG.url;
      if (wsUrl.indexOf('?') > -1) {
        wsUrl += '&token=' + encodeURIComponent(token);
      } else {
        wsUrl += '?token=' + encodeURIComponent(token);
      }
      
      // 创建WebSocket连接
      wx.connectSocket({
        url: wsUrl,
        header: {
          'Authorization': 'Bearer ' + token,
          'jwtToken': token
        },
        success: () => {
          console.log('WebSocket连接创建成功');
        },
        fail: (error) => {
          console.error('WebSocket连接创建失败:', error);
          reject(error);
        }
      });

      // 定义事件处理函数，确保在页面销毁时能正确移除
      this.onSocketOpenHandler = () => {
        console.log('WebSocket连接已打开');
        this.setData({ socketStatus: 'connected' });
        
        // 不在这里发送START_RECORDING命令，让分段录音逻辑来处理
        // 这样可以确保只在第一段录音时发送一次命令
        
        resolve();
      };

      this.onSocketErrorHandler = (error) => {
        console.error('WebSocket错误:', error);
        this.setData({ socketStatus: 'error' });
        reject(error);
      };

      this.onSocketCloseHandler = () => {
        console.log('WebSocket连接已关闭');
        this.setData({ socketStatus: 'closed' });
      };

      this.onSocketMessageHandler = (res) => {
        this.handleWebSocketMessage(res);
      };

      // 监听WebSocket事件
      wx.onSocketOpen(this.onSocketOpenHandler);
      wx.onSocketError(this.onSocketErrorHandler);
      wx.onSocketClose(this.onSocketCloseHandler);
      wx.onSocketMessage(this.onSocketMessageHandler);
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
      //console.log('收到音频帧数据，长度:', frameData.length);
      
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
          //console.log('发送音频数据，大小:', sendData.length);
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
        const currentTime = Date.now();
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array(),  // 重置音频缓冲区
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        // 只在第一段录音时重置计时器，分段重启时不重置
        if (this.data.isFirstSegment) {
          this.startTimer(true); // 重置时间
        } else {
          // 分段重启时，重新启动计时器但不重置时间
          // 因为 recordingTime 已经在 handleSegmentEnd 中被重置为 0
          this.startTimer(false); // 不重置时间，但重新启动计时器
        }
        
        this.startRecordingMonitor(); // 启动录音监控

        // 只在第一段录音时发送开始录音命令，避免服务器感知到分段
        if (this.data.isFirstSegment) {
          this.sendWebSocketMessage({
            command: 'START_RECORDING',
            config: {
              sampleRate: AUDIO_CONFIG.sampleRate,
              channels: AUDIO_CONFIG.numberOfChannels,
              frameSize: AUDIO_CONFIG.frameSize
            }
          });
        }
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
        this.stopRecordingMonitor(); // 停止录音监控
        
        // 发送剩余的音频数据
        if (this.data.audioBuffer.length > 0) {
          this.sendWebSocketMessage(this.data.audioBuffer.buffer);
        }
        
        // 检查是否需要继续录音（分段录音逻辑）
        this.handleSegmentEnd();
      });

      recorderManager.onError((error) => {
        console.error('录音错误:', error);
        
        // 在分段录音模式下，如果是录音管理器状态错误，尝试重启
        if (this.data.shouldContinueRecording && 
            error.errMsg && 
            error.errMsg.includes('is recording or paused')) {
          console.log('检测到录音状态错误，尝试重启录音段...');
          setTimeout(() => {
            this.restartRecording();
          }, 1000);
          return;
        }
        
        // 其他错误或非分段录音模式，显示错误提示
        wx.showToast({
          title: '录音出错，请重试',
          icon: 'none'
        });
        this.setData({ isRecording: false });
        this.closeWebSocket();
      });

      this.recorderManager = recorderManager;
      resolve(recorderManager);
    });
  },

  // 开始录音
  async startRecording() {
    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '录音功能需要登录后使用，是否立即登录？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }
    
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
      // 设置停止标志
      this.setData({ shouldContinueRecording: false });
      
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
      this.startTimer(false); // 恢复时不重置时间
    }
  },

  // 开始计时器
  startTimer(resetTime = true) {
    // 先清理旧的计时器，防止多次叠加
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`=== 开始计时器 ===`);
    console.log(`resetTime: ${resetTime}`);
    console.log(`当前recordingTime: ${this.data.recordingTime}`);
    console.log(`当前totalRecordingTime: ${this.data.totalRecordingTime}ms`);
    
    // 只有在重置时间时才重置录音时间
    if (resetTime) {
      console.log('重置录音时间');
      this.setData({ 
        recordingTime: 0,
        formattedTime: '00:00'
      });
    } else {
      console.log('不重置录音时间，保持连续性');
      // 计算当前应该显示的总时间
      const totalTimeSeconds = this.data.totalRecordingTime / 1000 + this.data.recordingTime;
      const formattedTime = this.formatDuration(totalTimeSeconds);
      this.setData({ formattedTime: formattedTime });
    }

    this.timer = setInterval(() => {
      const newTime = this.data.recordingTime + 1;
      const totalTime = this.data.totalRecordingTime / 1000 + newTime; // 转换为秒
      const formattedTime = this.formatDuration(totalTime);
      
      console.log(`计时器更新: recordingTime=${newTime}, totalTime=${totalTime}s, formattedTime=${formattedTime}`);
      
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
    const { recordingTime, recordingTitle, transcripts, recordingId, totalRecordingTime } = this.data;

    if (!recordingId) {
      wx.showToast({
        title: '录音ID无效',
        icon: 'none'
      });
      return;
    }

    // 计算总录音时长
    const totalTimeSeconds = (totalRecordingTime / 1000) + recordingTime;

    // 创建新的会议记录
    const newMeeting = {
      id: recordingId,
      title: recordingTitle,
      time: this.data.formattedDate.split(' ')[1],
      duration: this.formatDuration(totalTimeSeconds),
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
    
    // 保存当前录音状态
    this.setData({ 
      socketStatus: 'closed',
      shouldContinueRecording: false  // 停止继续录音
    });

    // 显示错误提示
    wx.showToast({
      title: '网络连接异常，录音已停止',
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
    let newItemId = null;
    
    // 检查是否已存在该时间戳的转写，如果存在则更新
    const existingIndex = transcripts.findIndex(item => 
      Math.abs(new Date(item.timestamp).getTime() - timestamp) < 1000
    );
    
    if (existingIndex >= 0) {
      // 更新现有的转写
      transcripts[existingIndex].text = text;
      transcripts[existingIndex].speakerId = speakerId;
      newItemId = transcripts[existingIndex].id || `transcript-${Date.now()}`;
      transcripts[existingIndex].id = newItemId;
    } else {
      // 生成唯一ID
      newItemId = `transcript-${Date.now()}`;
      
      // 添加新的转写
      transcripts.push({
        id: newItemId,
        text,
        timestamp,
        formattedTime,
        speakerId,
        isFinal: true
      });
      
      // 按时间戳排序
      transcripts.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // 创建淡入动画
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease',
    });
    animation.opacity(1).step();
    
    // 更新数据，先设置滚动到底部元素，然后再滚动到最新项
    this.setData({
      transcripts: transcripts,
      scrollToView: 'transcript-bottom',
      fadeIn: animation.export()
    });
    
    // 延迟微秒后再滚动到最新项，确保滚动效果生效
    setTimeout(() => {
      this.setData({
        scrollToView: newItemId
      });
    }, 50);
  },

  // 滚动到底部
  scrollToBottom() {
    // 始终滚动到底部元素，确保最新内容可见
    this.setData({
      scrollToView: 'transcript-bottom'
    });
    
    // 如果有最新的转录项，也可以滚动到该项
    if (this.data.transcripts && this.data.transcripts.length > 0) {
      const lastItem = this.data.transcripts[this.data.transcripts.length - 1];
      if (lastItem && lastItem.id) {
        this.setData({
          scrollToView: lastItem.id
        });
      }
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
        const currentTime = Date.now();
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array(),  // 重置音频缓冲区
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        // 只在第一段录音时重置计时器，分段重启时不重置
        if (this.data.isFirstSegment) {
          this.startTimer(true); // 重置时间
        } else {
          // 分段重启时，重新启动计时器但不重置时间
          // 因为 recordingTime 已经在 handleSegmentEnd 中被重置为 0
          this.startTimer(false); // 不重置时间，但重新启动计时器
        }
        
        this.startRecordingMonitor(); // 启动录音监控

        // 只在第一段录音时发送开始录音命令，避免服务器感知到分段
        if (this.data.isFirstSegment) {
          this.sendWebSocketMessage({
            command: 'START_RECORDING',
            config: {
              sampleRate: AUDIO_CONFIG.sampleRate,
              channels: AUDIO_CONFIG.numberOfChannels,
              frameSize: AUDIO_CONFIG.frameSize
            }
          });
        }
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
        this.stopRecordingMonitor(); // 停止录音监控
        
        // 发送剩余的音频数据
        if (this.data.audioBuffer.length > 0) {
          this.sendWebSocketMessage(this.data.audioBuffer.buffer);
        }
        
        // 检查是否需要继续录音（分段录音逻辑）
        this.handleSegmentEnd();
      });

      // 监听录音错误事件
      recorderManager.onError((error) => {
        console.error('录音错误:', error);
        
        // 在分段录音模式下，如果是录音管理器状态错误，尝试重启
        if (this.data.shouldContinueRecording && 
            error.errMsg && 
            error.errMsg.includes('is recording or paused')) {
          console.log('检测到录音状态错误，尝试重启录音段...');
          setTimeout(() => {
            this.restartRecording();
          }, 1000);
          return;
        }
        
        // 其他错误或非分段录音模式，显示错误提示
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
        duration: SEGMENT_CONFIG.segmentDuration,  // 使用分段录音时长
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
    const totalTimeSeconds = (this.data.totalRecordingTime / 1000) + this.data.recordingTime;
    const progress = (totalTimeSeconds / 10800) * 100; // 10800秒 = 3小时
    this.setData({
      progressPercent: Math.min(progress, 100)
    });
  },

  // 格式化时长
  formatDuration(seconds) {
    seconds = Math.floor(seconds); // 先取整，避免出现小数
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  // 处理录音段结束
  handleSegmentEnd() {
    const currentTime = Date.now();
    const segmentDuration = currentTime - this.data.segmentStartTime;
    const totalTime = this.data.totalRecordingTime + segmentDuration;
    
    console.log(`=== 录音段结束处理 ===`);
    console.log(`当前时间: ${currentTime}`);
    console.log(`段开始时间: ${this.data.segmentStartTime}`);
    console.log(`录音段 ${this.data.segmentIndex} 结束，时长: ${segmentDuration}ms (${segmentDuration/1000}s)`);
    console.log(`之前总时长: ${this.data.totalRecordingTime}ms (${this.data.totalRecordingTime/1000}s)`);
    console.log(`新的总时长: ${totalTime}ms (${totalTime/1000}s)`);
    console.log(`shouldContinueRecording: ${this.data.shouldContinueRecording}`);
    console.log(`autoRestart: ${SEGMENT_CONFIG.autoRestart}`);
    console.log(`当前状态:`, this.data);
    
    // 更新总录音时间
    this.setData({
      totalRecordingTime: totalTime,
      lastSegmentEndTime: currentTime,
      segmentIndex: this.data.segmentIndex + 1,
      isFirstSegment: false
    });
    
    console.log(`=== 更新后的状态 ===`);
    console.log(`更新后的 totalRecordingTime: ${totalTime}ms (${totalTime/1000}s)`);
    console.log(`更新后的 segmentIndex: ${this.data.segmentIndex + 1}`);
    
    // 检查是否达到最大录音时长
    if (totalTime >= SEGMENT_CONFIG.maxDuration) {
      console.log('达到最大录音时长，停止录音');
      this.setData({ shouldContinueRecording: false });
      this.stopTimer();
      this.closeWebSocket();
      return;
    }
    
    // 检查是否应该继续录音
    if (this.data.shouldContinueRecording && SEGMENT_CONFIG.autoRestart) {
      console.log('准备开始下一段录音...');
      this.setData({ isSegmentTransitioning: true });
      
      // 重置计时器的 recordingTime，但保持 totalRecordingTime
      // 这样计时器会从 0 开始，但总时间会正确累加
      this.setData({ recordingTime: 0 });
      
      console.log(`重置 recordingTime 为 0，保持 totalRecordingTime: ${totalTime}ms`);
      
      // 延迟重启录音，确保无缝连接
      setTimeout(() => {
        this.restartRecording();
      }, SEGMENT_CONFIG.overlapTime);
    } else {
      console.log('不继续录音，停止计时器和WebSocket');
      this.stopTimer();
      this.closeWebSocket();
    }
  },

  // 重启录音段
  async restartRecording() {
    console.log(`=== 重启录音段 ===`);
    console.log(`shouldContinueRecording: ${this.data.shouldContinueRecording}`);
    console.log(`segmentIndex: ${this.data.segmentIndex}`);
    console.log(`recorderManager:`, this.recorderManager);
    
    if (!this.data.shouldContinueRecording) {
      console.log('shouldContinueRecording为false，不重启录音');
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptRestart = async () => {
      try {
        console.log(`开始第 ${this.data.segmentIndex} 段录音`);
        
        // 确保录音管理器处于正确状态
        if (this.recorderManager) {
          // 先停止当前录音，确保状态正确
          try {
            this.recorderManager.stop();
            console.log('停止当前录音，准备重启');
            // 等待一小段时间确保状态更新
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (e) {
            console.log('停止录音时出现异常（可能是正常状态）:', e);
          }
        }
        
        // 设置当前段的开始时间
        const currentTime = Date.now();
        this.setData({
          segmentStartTime: currentTime,
          audioBuffer: new Int16Array(),
          isSegmentTransitioning: false
        });
        
        console.log(`第 ${this.data.segmentIndex} 段开始时间: ${currentTime}`);
        
        // 重新开始录音
        console.log('调用recorderManager.start...');
        this.recorderManager.start({
          duration: SEGMENT_CONFIG.segmentDuration,
          sampleRate: AUDIO_CONFIG.sampleRate,
          numberOfChannels: AUDIO_CONFIG.numberOfChannels,
          encodeBitRate: AUDIO_CONFIG.encodeBitRate,
          format: AUDIO_CONFIG.format,
          frameSize: AUDIO_CONFIG.frameSize,
          needFrame: AUDIO_CONFIG.needFrame
        });
        
        console.log('录音重启成功');
        
        // 不发送任何命令到服务器，保持音频流的连续性
        // 服务器端会认为这是一个连续的录音会话
        
      } catch (error) {
        console.error('重启录音失败:', error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`重启录音失败，第${retryCount}次重试...`);
          setTimeout(attemptRestart, 1000);
        } else {
          console.log('重试次数已达上限，停止录音');
          wx.showToast({
            title: '录音重启失败，请手动重试',
            icon: 'none'
          });
          this.setData({ shouldContinueRecording: false });
        }
      }
    };
    
    await attemptRestart();
  },

  // 监控录音状态
  startRecordingMonitor() {
    if (!this.data.debugMode) return;
    
    this.recordingMonitor = setInterval(() => {
      console.log(`=== 录音状态监控 ===`);
      console.log(`isRecording: ${this.data.isRecording}`);
      console.log(`segmentIndex: ${this.data.segmentIndex}`);
      console.log(`totalRecordingTime: ${this.data.totalRecordingTime}ms`);
      console.log(`recordingTime: ${this.data.recordingTime}s`);
      console.log(`shouldContinueRecording: ${this.data.shouldContinueRecording}`);
      console.log(`isSegmentTransitioning: ${this.data.isSegmentTransitioning}`);
      console.log(`socketStatus: ${this.data.socketStatus}`);
      
      // 检查录音是否意外停止
      // 只有在应该继续录音、不在切换状态、且录音确实停止时才重启
      if (this.data.shouldContinueRecording && 
          !this.data.isRecording && 
          !this.data.isSegmentTransitioning &&
          this.data.socketStatus === 'connected') {
        console.warn('检测到录音意外停止，尝试重启...');
        this.restartRecording();
      }
    }, 5000); // 每5秒检查一次
  },

  stopRecordingMonitor() {
    if (this.recordingMonitor) {
      clearInterval(this.recordingMonitor);
      this.recordingMonitor = null;
    }
  },
});
