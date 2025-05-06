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

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: this.data.allowedExtensions,
      success: (res) => {
        const file = res.tempFiles[0];
        console.log('Selected file:', file);
        
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
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  async handleUpload() {
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
      // 检查登录状态
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
      
      const uploadTask = wx.uploadFile({
        url: app.globalData.baseUrl + '/api/meetings/upload',
        filePath: file.path,
        name: 'file',
        header: {
          'Authorization': app.globalData.token
        },
        formData: {
          fileName: file.name
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
          wx.showToast({
            title: err.errMsg || '网络错误',
            icon: 'none'
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
  }
});
