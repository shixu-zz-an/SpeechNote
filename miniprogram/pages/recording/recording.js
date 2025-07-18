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
      console.log('=== initRecorder 开始 ===');
      console.log('WebSocket状态检查:', this.data.socketStatus);
      
      if (this.data.socketStatus !== 'connected') {
        console.error('WebSocket未连接，无法初始化录音管理器');
        reject(new Error('WebSocket未连接'));
        return;
      }
      
      console.log('请求录音权限...');
      wx.authorize({scope: "scope.record"});

      const recorderManager = wx.getRecorderManager();
      console.log('录音管理器实例创建完成');

      recorderManager.onStart(() => {
        console.log('=== 录音管理器 onStart 事件触发 (initRecorder) ===');
        const currentTime = Date.now();
        console.log('当前时间:', currentTime);
        console.log('是否第一段录音:', this.data.isFirstSegment);
        console.log('当前段索引:', this.data.segmentIndex);
        console.log('总录音时间:', this.data.totalRecordingTime);
        console.log('WebSocket状态:', this.data.socketStatus);
        
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array(),  // 重置音频缓冲区
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        console.log('录音状态已更新:', {
          isRecording: true,
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        // 只在第一段录音时重置计时器，分段重启时不重置
        if (this.data.isFirstSegment) {
          console.log('第一段录音，重置计时器');
          this.startTimer(true); // 重置时间
        } else {
          console.log('分段录音重启，不重置计时器时间');
          // 分段重启时，重新启动计时器但不重置时间
          // 因为 recordingTime 已经在 handleSegmentEnd 中被重置为 0
          this.startTimer(false); // 不重置时间，但重新启动计时器
        }
        
        console.log('启动录音监控...');
        this.startRecordingMonitor(); // 启动录音监控

        // 只在第一段录音时发送开始录音命令，避免服务器感知到分段
        if (this.data.isFirstSegment) {
          console.log('第一段录音，发送 START_RECORDING 命令到服务器');
          const success = this.sendWebSocketMessage({
            command: 'START_RECORDING',
            config: {
              sampleRate: AUDIO_CONFIG.sampleRate,
              channels: AUDIO_CONFIG.numberOfChannels,
              frameSize: AUDIO_CONFIG.frameSize
            }
          });
          console.log('START_RECORDING 命令发送结果:', success);
        } else {
          console.log('分段录音重启，不发送 START_RECORDING 命令（保持服务器端连续性）');
        }
        
        console.log('=== 录音管理器 onStart 处理完成 (initRecorder) ===');
      });

      recorderManager.onFrameRecorded((res) => {
        // 每10秒打印一次帧数据状态，避免日志过多
        if (!this.frameLogCounter) this.frameLogCounter = 0;
        this.frameLogCounter++;
        
        if (this.frameLogCounter % 100 === 0) { // 大约每10秒打印一次
          console.log('=== 音频帧数据接收状态 ===');
          console.log('帧计数器:', this.frameLogCounter);
          console.log('WebSocket状态:', this.data.socketStatus);
          console.log('录音状态:', this.data.isRecording);
          console.log('当前段索引:', this.data.segmentIndex);
          console.log('帧数据大小:', res.frameBuffer ? res.frameBuffer.byteLength : 'null');
        }
        
        if (this.data.socketStatus === 'connected' && res.frameBuffer) {
          try {
            // 直接传递帧数据对象
            this.processAudioChunks(res);
          } catch (error) {
            console.error('=== 处理音频帧数据失败 ===');
            console.error('错误详情:', error);
            console.error('帧数据:', res);
            console.error('当前状态:', {
              socketStatus: this.data.socketStatus,
              isRecording: this.data.isRecording,
              segmentIndex: this.data.segmentIndex
            });
          }
        } else {
          if (this.frameLogCounter % 50 === 0) { // 减少频率
            console.log('跳过帧数据处理:', {
              socketConnected: this.data.socketStatus === 'connected',
              hasFrameBuffer: !!res.frameBuffer
            });
          }
        }
      });

      recorderManager.onStop(() => {
        console.log('=== 录音管理器 onStop 事件触发 ===');
        console.log('停止时间:', Date.now());
        console.log('当前段索引:', this.data.segmentIndex);
        console.log('段开始时间:', this.data.segmentStartTime);
        console.log('应该继续录音:', this.data.shouldContinueRecording);
        console.log('总录音时间:', this.data.totalRecordingTime);
        console.log('当前段录音时间:', this.data.recordingTime);
        
        this.setData({ isRecording: false });
        console.log('录音状态已设为false');
        
        this.stopRecordingMonitor(); // 停止录音监控
        console.log('录音监控已停止');
        
        // 发送剩余的音频数据
        if (this.data.audioBuffer.length > 0) {
          console.log('发送剩余音频数据，大小:', this.data.audioBuffer.length);
          this.sendWebSocketMessage(this.data.audioBuffer.buffer);
        } else {
          console.log('无剩余音频数据需要发送');
        }
        
        // 检查是否需要继续录音（分段录音逻辑）
        console.log('开始处理录音段结束逻辑...');
        this.handleSegmentEnd();
        console.log('=== 录音管理器 onStop 处理完成 ===');
      });

      recorderManager.onError((error) => {
        console.error('=== 录音管理器 onError 事件触发 ===');
        console.error('错误详情:', error);
        console.error('错误消息:', error.errMsg);
        console.error('错误代码:', error.errCode);
        console.log('当前状态:', {
          isRecording: this.data.isRecording,
          segmentIndex: this.data.segmentIndex,
          shouldContinueRecording: this.data.shouldContinueRecording,
          socketStatus: this.data.socketStatus,
          totalRecordingTime: this.data.totalRecordingTime,
          isSegmentTransitioning: this.data.isSegmentTransitioning
        });
        
        // 检查是否是可恢复的错误（在分段录音重启过程中）
        const isRecoverableError = this.data.shouldContinueRecording && error.errMsg && (
          error.errMsg.includes('is recording or paused') ||
          error.errMsg.includes('recorder not start') // 新增：录音未启动也是可恢复的
        );
        
        if (isRecoverableError) {
          console.log('检测到可恢复的录音错误，尝试重启录音段...');
          console.log('错误类型:', error.errMsg);
          
          // 如果是 "recorder not start" 错误且在重启过程中，这是正常的
          if (error.errMsg.includes('recorder not start') && this.data.isSegmentTransitioning) {
            console.log('重启过程中的正常错误，忽略处理');
            return;
          }
          
          console.log('1秒后将尝试重启录音');
          setTimeout(() => {
            console.log('开始执行录音重启...');
            this.restartRecording();
          }, 1000);
          return;
        }
        
        // 其他错误或非分段录音模式，显示错误提示
        console.error('录音发生不可恢复的错误，停止录音');
        console.error('错误分类: 不可恢复错误');
        wx.showToast({
          title: '录音出错，请重试',
          icon: 'none'
        });
        this.setData({ isRecording: false });
        this.closeWebSocket();
        console.log('=== 录音错误处理完成 ===');
      });

      this.recorderManager = recorderManager;
      resolve(recorderManager);
    });
  },

  // 开始录音
  async startRecording() {
    console.log('=== startRecording 调用 ===');
    console.log('当前录音状态:', this.data.isRecording);
    console.log('当前WebSocket状态:', this.data.socketStatus);
    
    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLogin) {
      console.log('用户未登录，显示登录提示');
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
    
    if (this.data.isRecording) {
      console.log('当前已在录音状态，跳过重复启动');
      return;
    }

    try {
      console.log('开始初始化录音环境...');
      
      // 确保WebSocket已连接
      if (this.data.socketStatus !== 'connected') {
        console.log('WebSocket未连接，开始初始化WebSocket...');
        await this.initWebSocket();
        console.log('WebSocket初始化完成，状态:', this.data.socketStatus);
      }

      // 初始化录音
      console.log('开始初始化录音管理器...');
      await this.initRecorder();
      console.log('录音管理器初始化完成');

      // 更新状态
      console.log('更新录音状态...');
      this.setData({
        isRecording: true,
        transcripts: [],
        recordingTime: 0,
        formattedTime: '0:00',
        audioBuffer: new Int16Array()
      });

      // 开始计时
      console.log('启动计时器...');
      this.startTimer();

      // 开始波形动画
      console.log('启动波形动画...');
      this.startWaveformAnimation();

      console.log('=== startRecording 完成 ===');
    } catch (error) {
      console.error('=== startRecording 失败 ===');
      console.error('错误详情:', error);
      console.error('错误堆栈:', error.stack);
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
    console.log('=== 准备发送WebSocket消息 ===');
    console.log('WebSocket状态:', this.data.socketStatus);
    console.log('消息类型:', message instanceof ArrayBuffer ? '音频数据' : '控制命令');
    
    if (this.data.socketStatus !== 'connected') {
      console.error('WebSocket未连接，无法发送消息');
      console.error('当前状态:', this.data.socketStatus);
      return false;
    }

    try {
      // 如果是ArrayBuffer，直接发送二进制数据
      if (message instanceof ArrayBuffer) {
        if (!this.audioDataLogCounter) this.audioDataLogCounter = 0;
        this.audioDataLogCounter++;
        
        // 每100次音频数据发送打印一次日志
        if (this.audioDataLogCounter % 100 === 0) {
          console.log('=== 音频数据发送状态 ===');
          console.log('累计发送次数:', this.audioDataLogCounter);
          console.log('数据大小:', message.byteLength);
          console.log('当前段索引:', this.data.segmentIndex);
        }
        
        wx.sendSocketMessage({
          data: message,
          success: () => {
            if (this.audioDataLogCounter % 100 === 0) {
              console.log('音频数据发送成功，大小:', message.byteLength);
            }
            return true;
          },
          fail: (error) => {
            console.error('=== 音频数据发送失败 ===');
            console.error('错误详情:', error);
            console.error('数据大小:', message.byteLength);
            console.error('当前段索引:', this.data.segmentIndex);
            this.handleWebSocketError(error);
            return false;
          }
        });
      } else {
        // 其他消息（如控制命令）转为JSON发送
        console.log('发送控制命令:', JSON.stringify(message));
        wx.sendSocketMessage({
          data: JSON.stringify(message),
          success: () => {
            console.log('控制命令发送成功:', message.command || '未知命令');
            return true;
          },
          fail: (error) => {
            console.error('=== 控制命令发送失败 ===');
            console.error('错误详情:', error);
            console.error('命令内容:', message);
            this.handleWebSocketError(error);
            return false;
          }
        });
      }
    } catch (error) {
      console.error('=== 发送消息时出错 ===');
      console.error('错误详情:', error);
      console.error('错误堆栈:', error.stack);
      console.error('消息内容:', message instanceof ArrayBuffer ? '音频数据' : message);
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
    console.log('=== 收到WebSocket消息 ===');
    console.log('原始消息:', res.data);
    console.log('消息长度:', res.data ? res.data.length : 0);
    
    try {
      const data = JSON.parse(res.data);
      console.log('解析后的消息:', data);
      console.log('消息类型:', data.type);
      
      // 处理服务器返回的消息
      switch (data.type) {
        case 'START_RECORDING':
          console.log('=== 处理 START_RECORDING 消息 ===');
          console.log('收到录音ID:', data.recordId);
          // 服务器返回录音ID和初始化状态
          this.setData({
            recordingId: data.recordId
          });
          console.log("录音ID已设置，当前数据:", {
            recordingId: this.data.recordingId,
            segmentIndex: this.data.segmentIndex,
            isFirstSegment: this.data.isFirstSegment
          });
          break;
        
        case 'TRANSCRIPTION':
          console.log('=== 处理 TRANSCRIPTION 消息 ===');
          console.log('转录文本:', data.text);
          console.log('时间戳:', data.timestamp);
          console.log('说话人ID:', data.speakerId);
          // 处理转写结果
          this.handleTranscription(data);
          break;
        
        case 'error':
          console.error('=== 处理服务器错误消息 ===');
          console.error('错误消息:', data.message);
          console.error('错误代码:', data.code);
          console.error('完整错误数据:', data);
          // 处理错误
          wx.showToast({
            title: '服务器错误: ' + data.message,
            icon: 'none'
          });
          break;
          
        default:
          console.log('=== 未知消息类型 ===');
          console.log('消息类型:', data.type);
          console.log('完整消息:', data);
          break;
      }
    } catch (error) {
      console.error('=== 解析WebSocket消息失败 ===');
      console.error('错误详情:', error);
      console.error('错误堆栈:', error.stack);
      console.error('原始消息数据:', res.data);
      console.error('消息数据类型:', typeof res.data);
    }
  },

  handleTranscription(data) {
    console.log('=== 开始处理转录结果 ===');
    console.log('原始转录数据:', data);
    
    // 处理转写结果
    const { text, timestamp=Date.now(), speakerId="speaker" } = data;
    console.log('解析后的转录信息:', {
      text: text,
      timestamp: timestamp,
      speakerId: speakerId,
      textLength: text ? text.length : 0
    });

    if (!text || text.trim() === '') {
      console.log('转录文本为空，跳过处理');
      return;
    }
    
    // 格式化时间戳
    const date = new Date(timestamp);
    const formattedTime = this.formatTime(date);
    console.log('格式化时间:', formattedTime);

    // 添加到转写结果列表
    const transcripts = this.data.transcripts;
    console.log('当前转录列表长度:', transcripts.length);
    let newItemId = null;
    
    // 检查是否已存在该时间戳的转写，如果存在则更新
    const existingIndex = transcripts.findIndex(item => 
      Math.abs(new Date(item.timestamp).getTime() - timestamp) < 1000
    );
    
    console.log('查找现有转录索引:', existingIndex);
    
    if (existingIndex >= 0) {
      console.log('更新现有转录项，索引:', existingIndex);
      // 更新现有的转写
      transcripts[existingIndex].text = text;
      transcripts[existingIndex].speakerId = speakerId;
      newItemId = transcripts[existingIndex].id || `transcript-${Date.now()}`;
      transcripts[existingIndex].id = newItemId;
      console.log('转录项已更新:', transcripts[existingIndex]);
    } else {
      // 生成唯一ID
      newItemId = `transcript-${Date.now()}`;
      console.log('创建新转录项，ID:', newItemId);
      
      // 添加新的转写
      const newTranscript = {
        id: newItemId,
        text,
        timestamp,
        formattedTime,
        speakerId,
        isFinal: true
      };
      
      transcripts.push(newTranscript);
      console.log('新转录项已添加:', newTranscript);
      
      // 按时间戳排序
      transcripts.sort((a, b) => a.timestamp - b.timestamp);
      console.log('转录列表已排序，新长度:', transcripts.length);
    }
    
    // 创建淡入动画
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease',
    });
    animation.opacity(1).step();
    
    console.log('准备更新页面数据...');
    // 更新数据，先设置滚动到底部元素，然后再滚动到最新项
    this.setData({
      transcripts: transcripts,
      scrollToView: 'transcript-bottom',
      fadeIn: animation.export()
    });
    
    console.log('页面数据已更新，转录列表长度:', this.data.transcripts.length);
    
    // 延迟微秒后再滚动到最新项，确保滚动效果生效
    setTimeout(() => {
      console.log('设置滚动到新项:', newItemId);
      this.setData({
        scrollToView: newItemId
      });
    }, 50);
    
    console.log('=== 转录结果处理完成 ===');
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
        console.log('=== 录音管理器 onStart 事件触发 (initAndStartRecording) ===');
        const currentTime = Date.now();
        console.log('当前时间:', currentTime);
        console.log('是否第一段录音:', this.data.isFirstSegment);
        console.log('当前段索引:', this.data.segmentIndex);
        console.log('总录音时间:', this.data.totalRecordingTime);
        console.log('WebSocket状态:', this.data.socketStatus);
        
        this.setData({ 
          isRecording: true,
          audioBuffer: new Int16Array(),  // 重置音频缓冲区
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        console.log('录音状态已更新:', {
          isRecording: true,
          segmentStartTime: currentTime,
          isSegmentTransitioning: false
        });
        
        // 只在第一段录音时重置计时器，分段重启时不重置
        if (this.data.isFirstSegment) {
          console.log('第一段录音，重置计时器');
          this.startTimer(true); // 重置时间
        } else {
          console.log('分段录音重启，不重置计时器时间');
          // 分段重启时，重新启动计时器但不重置时间
          // 因为 recordingTime 已经在 handleSegmentEnd 中被重置为 0
          this.startTimer(false); // 不重置时间，但重新启动计时器
        }
        
        console.log('启动录音监控...');
        this.startRecordingMonitor(); // 启动录音监控

        // 只在第一段录音时发送开始录音命令，避免服务器感知到分段
        if (this.data.isFirstSegment) {
          console.log('第一段录音，发送 START_RECORDING 命令到服务器');
          const success = this.sendWebSocketMessage({
            command: 'START_RECORDING',
            config: {
              sampleRate: AUDIO_CONFIG.sampleRate,
              channels: AUDIO_CONFIG.numberOfChannels,
              frameSize: AUDIO_CONFIG.frameSize
            }
          });
          console.log('START_RECORDING 命令发送结果:', success);
        } else {
          console.log('分段录音重启，不发送 START_RECORDING 命令（保持服务器端连续性）');
        }
        
        console.log('=== 录音管理器 onStart 处理完成 (initAndStartRecording) ===');
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
        console.error('=== 录音管理器 onError 事件触发 (initAndStartRecording) ===');
        console.error('错误详情:', error);
        console.error('错误消息:', error.errMsg);
        console.error('错误代码:', error.errCode);
        console.log('当前状态:', {
          isRecording: this.data.isRecording,
          segmentIndex: this.data.segmentIndex,
          shouldContinueRecording: this.data.shouldContinueRecording,
          socketStatus: this.data.socketStatus,
          totalRecordingTime: this.data.totalRecordingTime,
          isSegmentTransitioning: this.data.isSegmentTransitioning
        });
        
        // 检查是否是可恢复的错误（在分段录音重启过程中）
        const isRecoverableError = this.data.shouldContinueRecording && error.errMsg && (
          error.errMsg.includes('is recording or paused') ||
          error.errMsg.includes('recorder not start') // 新增：录音未启动也是可恢复的
        );
        
        if (isRecoverableError) {
          console.log('检测到可恢复的录音错误，尝试重启录音段...');
          console.log('错误类型:', error.errMsg);
          
          // 如果是 "recorder not start" 错误且在重启过程中，这是正常的
          if (error.errMsg.includes('recorder not start') && this.data.isSegmentTransitioning) {
            console.log('重启过程中的正常错误，忽略处理');
            return;
          }
          
          console.log('1秒后将尝试重启录音');
          setTimeout(() => {
            console.log('开始执行录音重启...');
            this.restartRecording();
          }, 1000);
          return;
        }
        
        // 其他错误或非分段录音模式，显示错误提示
        console.error('录音发生不可恢复的错误，停止录音');
        console.error('错误分类: 不可恢复错误');
        wx.showToast({
          title: '录音出错，请重试',
          icon: 'none'
        });
        this.setData({ isRecording: false });
        this.closeWebSocket();
        console.log('=== 录音错误处理完成 (initAndStartRecording) ===');
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
      console.log('设置 isSegmentTransitioning 为 true');
      this.setData({ 
        isSegmentTransitioning: true,
        recordingTime: 0  // 重置计时器的 recordingTime，但保持 totalRecordingTime
      });
      
      console.log(`重置 recordingTime 为 0，保持 totalRecordingTime: ${totalTime}ms`);
      
      // 延迟重启录音，确保无缝连接
      console.log(`将在 ${SEGMENT_CONFIG.overlapTime}ms 后重启录音...`);
      setTimeout(() => {
        console.log('开始执行延迟重启录音...');
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
    console.log(`=== 开始重启录音段 ===`);
    console.log(`重启时间: ${Date.now()}`);
    console.log(`shouldContinueRecording: ${this.data.shouldContinueRecording}`);
    console.log(`segmentIndex: ${this.data.segmentIndex}`);
    console.log(`totalRecordingTime: ${this.data.totalRecordingTime}ms`);
    console.log(`recordingTime: ${this.data.recordingTime}s`);
    console.log(`WebSocket状态: ${this.data.socketStatus}`);
    console.log(`recordingId: ${this.data.recordingId}`);
    console.log(`recorderManager存在:`, !!this.recorderManager);
    
    if (!this.data.shouldContinueRecording) {
      console.log('shouldContinueRecording为false，停止重启录音');
      return;
    }
    
    if (!this.recorderManager) {
      console.error('录音管理器不存在，无法重启');
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptRestart = async () => {
      try {
        console.log(`=== 第${retryCount + 1}次尝试重启 ===`);
        console.log(`开始第 ${this.data.segmentIndex} 段录音`);
        console.log(`尝试时间: ${Date.now()}`);
        console.log(`当前录音状态: ${this.data.isRecording}`);
        
        // 确保录音管理器处于正确状态
        if (this.recorderManager) {
          console.log('检查录音管理器状态...');
          console.log('当前录音状态:', this.data.isRecording);
          
          // 只有在录音状态为true时才尝试停止，避免对已停止的录音管理器调用stop()
          if (this.data.isRecording) {
            console.log('录音状态为true，准备停止当前录音...');
            try {
              this.recorderManager.stop();
              console.log('已调用stop()，等待状态更新...');
              // 等待一小段时间确保状态更新
              await new Promise(resolve => setTimeout(resolve, 500));
              console.log('状态更新等待完成');
            } catch (e) {
              console.log('停止录音时出现异常:', e);
              console.log('异常详情:', e.errMsg);
              // 如果是 "recorder not start" 错误，这是可以接受的
              if (e.errMsg && e.errMsg.includes('recorder not start')) {
                console.log('录音管理器已停止，这是正常状态');
              }
            }
          } else {
            console.log('录音状态为false，跳过stop()调用，录音管理器可能已自动停止');
            // 仍然等待一小段时间，确保状态稳定
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // 设置当前段的开始时间
        const currentTime = Date.now();
        console.log(`设置第 ${this.data.segmentIndex} 段开始时间: ${currentTime}`);
        
        this.setData({
          segmentStartTime: currentTime,
          audioBuffer: new Int16Array(),
          isSegmentTransitioning: false
        });
        
        console.log('状态已更新:', {
          segmentStartTime: currentTime,
          audioBufferLength: 0,
          isSegmentTransitioning: false
        });
        
        // 检查WebSocket状态，如果断开则尝试重连
        if (this.data.socketStatus !== 'connected') {
          console.error('WebSocket未连接，尝试重新连接...');
          console.error('当前WebSocket状态:', this.data.socketStatus);
          
          try {
            console.log('开始重新初始化WebSocket连接...');
            await this.initWebSocket();
            console.log('WebSocket重连成功，状态:', this.data.socketStatus);
            
            if (this.data.socketStatus !== 'connected') {
              throw new Error('WebSocket重连失败');
            }
          } catch (wsError) {
            console.error('WebSocket重连失败:', wsError);
            throw new Error('WebSocket连接无法恢复');
          }
        }
        
        // 重新开始录音
        console.log('准备调用recorderManager.start...');
        console.log('录音参数:', {
          duration: SEGMENT_CONFIG.segmentDuration,
          sampleRate: AUDIO_CONFIG.sampleRate,
          numberOfChannels: AUDIO_CONFIG.numberOfChannels,
          encodeBitRate: AUDIO_CONFIG.encodeBitRate,
          format: AUDIO_CONFIG.format,
          frameSize: AUDIO_CONFIG.frameSize,
          needFrame: AUDIO_CONFIG.needFrame
        });
        
        this.recorderManager.start({
          duration: SEGMENT_CONFIG.segmentDuration,
          sampleRate: AUDIO_CONFIG.sampleRate,
          numberOfChannels: AUDIO_CONFIG.numberOfChannels,
          encodeBitRate: AUDIO_CONFIG.encodeBitRate,
          format: AUDIO_CONFIG.format,
          frameSize: AUDIO_CONFIG.frameSize,
          needFrame: AUDIO_CONFIG.needFrame
        });
        
        console.log('recorderManager.start() 调用完成');
        console.log('录音重启成功，等待onStart事件...');
        
        // 不发送任何命令到服务器，保持音频流的连续性
        // 服务器端会认为这是一个连续的录音会话
        console.log('不发送START_RECORDING命令，保持服务器端连续性');
        
      } catch (error) {
        console.error(`=== 第${retryCount + 1}次重启录音失败 ===`);
        console.error('错误详情:', error);
        console.error('错误消息:', error.errMsg);
        console.error('错误代码:', error.errCode);
        console.error('错误堆栈:', error.stack);
        
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`准备进行第${retryCount + 1}次重试，${2000}ms后执行...`);
          setTimeout(() => {
            console.log(`开始第${retryCount + 1}次重试`);
            attemptRestart();
          }, 2000); // 增加重试间隔
        } else {
          console.error('=== 重试次数已达上限，停止录音 ===');
          console.error(`总共尝试了${maxRetries}次重启，均失败`);
          
          wx.showToast({
            title: '录音重启失败，请手动重试',
            icon: 'none'
          });
          
          this.setData({ 
            shouldContinueRecording: false,
            isRecording: false
          });
          
          // 关闭WebSocket连接
          this.closeWebSocket();
        }
      }
    };
    
    console.log('开始执行重启尝试...');
    await attemptRestart();
    console.log('=== 重启录音段函数执行完成 ===');
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
        console.warn('触发意外停止重启，当前状态:', {
          shouldContinueRecording: this.data.shouldContinueRecording,
          isRecording: this.data.isRecording,
          isSegmentTransitioning: this.data.isSegmentTransitioning,
          socketStatus: this.data.socketStatus
        });
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
