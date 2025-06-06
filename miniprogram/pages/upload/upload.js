const app = getApp();
const { formatFileSize } = require('../../utils/util');

Page({
  data: {
    selectedFile: null,
    uploading: false,
    uploadProgress: 0,
    audioFormats: '.mp3、.wav、.m4a、.wma、.aac、.ogg、.amr、.flac',
    videoFormats: '.mp4、.wmv、.m4v、.flv、.rmvb、.dat、.mov、.mkv、.webm',
    allowedExtensions: [
      'mp3', 'wav', 'm4a', 'wma', 'aac', 'ogg', 'amr', 'flac',
      'mp4', 'wmv', 'm4v', 'flv', 'rmvb', 'dat', 'mov', 'mkv', 'webm'
    ]
  },

  handleBack() {
    wx.navigateBack();
  },

  // 从微信选择文件
  chooseFileFromWechat() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: this.data.allowedExtensions,
      success: (res) => {
        const file = res.tempFiles[0];
        console.log('Selected file from WeChat:', file);
        this.processSelectedFile(file);
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 从设备选择文件
  chooseFileFromDevice() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video', 'audio'],
      sourceType: ['album', 'camera'],
      // 移除maxDuration参数，避免出现错误
      camera: 'back',
      success: (res) => {
        const file = res.tempFiles[0];
        console.log('Selected file from device:', file);
        
        // 转换为统一格式处理
        const processedFile = {
          name: file.tempFilePath.split('/').pop() || '录音文件.mp3',
          path: file.tempFilePath,
          size: file.size,
          duration: file.duration,
          fileType: file.fileType
        };
        
        this.processSelectedFile(processedFile);
      },
      fail: (err) => {
        console.error('选择媒体文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 处理选择的文件
  processSelectedFile(file) {
    // 获取文件扩展名
    const fileName = file.name.toLowerCase();
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      wx.showToast({
        title: '无法识别文件格式',
        icon: 'none'
      });
      return;
    }
    
    const extension = fileName.substring(lastDotIndex);
    
    // 检查文件格式和大小
    if (['.mp3', '.wav', '.m4a', '.wma', '.aac', '.ogg', '.amr', '.flac'].includes(extension)) {
      if (file.size > 500 * 1024 * 1024) { // 500MB
        wx.showToast({
          title: '音频文件大小不能超过500MB',
          icon: 'none'
        });
        return;
      }
    } else if (['.mp4', '.wmv', '.m4v', '.flv', '.rmvb', '.dat', '.mov', '.mkv', '.webm'].includes(extension)) {
      if (file.size > 6 * 1024 * 1024 * 1024) { // 6GB
        wx.showToast({
          title: '视频文件大小不能超过6GB',
          icon: 'none'
        });
        return;
      }
    } else {
      wx.showToast({
        title: '不支持的文件格式',
        icon: 'none'
      });
      return;
    }

    this.setData({
      selectedFile: {
        name: file.name,
        path: file.path,
        size: file.size,
        formattedSize: formatFileSize(file.size)
      }
    });
  },

  async handleUpload() {
    // 检查登录状态
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '文件上传功能需要登录后使用，是否立即登录？',
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
    
    if (!this.data.selectedFile) {
      wx.showToast({
        title: '请先选择文件',
        icon: 'none'
      });
      return;
    }

    const file = this.data.selectedFile;
    this.setData({ uploading: true, uploadProgress: 0 });
    
    console.log('开始上传文件:', file);

    try {
      // 检查token（这里作为二次检查）
      if (!app.globalData.token) {
        console.error('未登录状态，无法上传');
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }, 1500);
        return;
      }
      
      // 从文件名中提取标题（去掉扩展名）
      const fileName = file.name;
      const lastDotIndex = fileName.lastIndexOf('.');
      const title = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
      
      const uploadTask = wx.uploadFile({
        url: app.globalData.baseUrl + '/api/fileUpload/audio',  // 使用正确的API端点
        filePath: file.path,
        name: 'file',
        header: {
          'Authorization': app.globalData.token
        },
        formData: {
          title: title
        },
        success: (res) => {
          console.log('上传响应:', res);
          
          if (res.statusCode === 200) {
            let data;
            try {
              data = JSON.parse(res.data);
              console.log('解析后的响应数据:', data);
            } catch (e) {
              console.error('解析响应数据失败:', e, res.data);
              wx.showToast({
                title: '服务器响应异常',
                icon: 'none'
              });
              return;
            }
            
            if (data.success) {
              wx.showToast({
                title: '上传成功',
                icon: 'success'
              });
              
              // 上传成功后返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({
                title: data.message || '上传失败',
                icon: 'none'
              });
            }
          } else if (res.statusCode === 401) {
            console.error('Token失效，需要重新登录');
            wx.showToast({
              title: '登录已过期，请重新登录',
              icon: 'none'
            });
            setTimeout(() => {
              wx.navigateTo({
                url: '/pages/login/login'
              });
            }, 1500);
          } else {
            console.error('上传失败，状态码:', res.statusCode);
            wx.showToast({
              title: `上传失败 (${res.statusCode})`,
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('上传请求失败:', err);
          
          // 处理 ERR_EMPTY_RESPONSE 错误
          let errorMsg = '网络错误';
          if (err.errMsg && err.errMsg.includes('ERR_EMPTY_RESPONSE')) {
            errorMsg = '服务器无响应，请检查后端服务是否正常运行';
            
            // 尝试备用端点
            this.tryBackupEndpoint(file.path, title);
            return;
          }
          
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 3000
          });
        },
        complete: () => {
          this.setData({ uploading: false, uploadProgress: 0 });
        }
      });
      
      // 监听上传进度
      uploadTask.onProgressUpdate((res) => {
        console.log('上传进度:', res.progress);
        this.setData({
          uploadProgress: res.progress
        });
      });
      
    } catch (error) {
      console.error('上传过程发生异常:', error);
      wx.showToast({
        title: error.message || '上传失败',
        icon: 'none'
      });
      this.setData({ uploading: false, uploadProgress: 0 });
    }
  },
  
  // 尝试备用端点
  tryBackupEndpoint(filePath, title) {
    console.log('尝试使用备用上传端点...');
    
    const uploadTask = wx.uploadFile({
      url: app.globalData.baseUrl + '/api/fileUpload/audio',  // 尝试备用端点
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': app.globalData.token
      },
      formData: {
        title: title
      },
      success: (res) => {
        console.log('备用端点上传响应:', res);
        
        if (res.statusCode === 200) {
          let data;
          try {
            data = JSON.parse(res.data);
            console.log('解析后的响应数据:', data);
          } catch (e) {
            console.error('解析响应数据失败:', e, res.data);
            wx.showToast({
              title: '服务器响应异常',
              icon: 'none'
            });
            return;
          }
          
          if (data.success) {
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            });
            
            // 上传成功后返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } else {
            wx.showToast({
              title: data.message || '上传失败',
              icon: 'none'
            });
          }
        } else {
          console.error('备用端点上传失败，状态码:', res.statusCode);
          wx.showToast({
            title: `上传失败 (${res.statusCode})`,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('备用端点上传请求失败:', err);
        wx.showToast({
          title: '所有上传端点均失败，请检查网络或服务器状态',
          icon: 'none',
          duration: 3000
        });
      },
      complete: () => {
        this.setData({ uploading: false, uploadProgress: 0 });
      }
    });
    
    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      console.log('备用端点上传进度:', res.progress);
      this.setData({
        uploadProgress: res.progress
      });
    });
  }
});
