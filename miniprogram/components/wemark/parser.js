/**
 * Simple Markdown Parser for WeChat Mini Program
 */

const inlineRules = {
  // 强调
  strong: /^(\*\*|__)(.*?)\1/,
  // 斜体
  em: /^(\*|_)(.*?)\1/,
  // 删除线
  deleted: /^~~(.*?)~~/,
  // 行内代码
  inlineCode: /^`(.*?)`/,
  // 链接
  link: /^\[(.*?)\]\((.*?)\)/,
};

function parse(md, options = {}) {
  if (!md) {
    return {};
  }

  const lines = md.split('\n');
  const tokens = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // 标题
    if (line.startsWith('#')) {
      let level = 0;
      while (line.charAt(level) === '#' && level < 6) {
        level++;
      }
      
      if (level > 0 && (line.charAt(level) === ' ' || line.charAt(level) === '\t')) {
        tokens.push({
          type: 'heading',
          content: line.substring(level + 1).trim(),
          level: level
        });
        continue;
      }
    }
    
    // 水平分割线
    if (/^[-*_]{3,}$/.test(line)) {
      tokens.push({
        type: 'hr'
      });
      continue;
    }
    
    // 列表项
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      let isOrdered = /^\d+\.\s/.test(line);
      let content = isOrdered ? line.replace(/^\d+\.\s/, '') : line.substring(2);
      
      tokens.push({
        type: isOrdered ? 'ol' : 'ul',
        content: parseInline(content)
      });
      continue;
    }
    
    // 代码块
    if (line.startsWith('```')) {
      let language = line.substring(3).trim();
      let codeContent = [];
      i++;
      
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent.push(lines[i]);
        i++;
      }
      
      tokens.push({
        type: 'code',
        content: codeContent.join('\n'),
        language: language
      });
      continue;
    }
    
    // 普通段落
    if (line) {
      tokens.push({
        type: 'paragraph',
        content: parseInline(line)
      });
    } else {
      // 空行
      tokens.push({
        type: 'space'
      });
    }
  }
  
  return {
    tokens: tokens
  };
}

function parseInline(text) {
  if (!text) {
    return [];
  }
  
  const result = [];
  let lastIndex = 0;
  let match;
  
  // 处理强调
  while ((match = findMatch(text, lastIndex))) {
    // 添加匹配前的普通文本
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // 添加匹配的特殊格式
    result.push({
      type: match.type,
      content: match.content
    });
    
    lastIndex = match.lastIndex;
  }
  
  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return result;
}

function findMatch(text, startIndex) {
  let earliestMatch = null;
  let earliestIndex = text.length;
  
  for (const type in inlineRules) {
    const rule = inlineRules[type];
    const match = rule.exec(text.substring(startIndex));
    
    if (match && match.index < earliestIndex) {
      earliestIndex = match.index;
      earliestMatch = {
        type: type,
        content: match[2] || match[1],
        index: startIndex + match.index,
        lastIndex: startIndex + match.index + match[0].length
      };
    }
  }
  
  return earliestMatch;
}

module.exports = {
  parse: parse
};
