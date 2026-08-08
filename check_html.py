import html.parser
import sys

class HTMLChecker(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []
        self.tags = []
        self.line_number = 1
        
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, self.line_number))
        
    def handle_endtag(self, tag):
        if self.tags and self.tags[-1][0] == tag:
            self.tags.pop()
        else:
            self.errors.append(f'第{self.line_number}行: 不匹配的结束标签: {tag}')
            
    def handle_data(self, data):
        self.line_number += data.count('\n')
        
    def error(self, message):
        self.errors.append(f'第{self.line_number}行: 解析错误: {message}')

def main():
    if len(sys.argv) != 2:
        print('用法: python check_html.py <文件名>')
        sys.exit(1)
    
    filename = sys.argv[1]
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        checker = HTMLChecker()
        checker.feed(content)
        
        if checker.tags:
            for tag, line in checker.tags:
                checker.errors.append(f'第{line}行: 未关闭的标签: {tag}')
        
        if checker.errors:
            print('HTML语法错误:')
            for error in checker.errors:
                print(f'  - {error}')
            sys.exit(1)
        else:
            print('HTML语法检查通过，未发现错误。')
            
    except FileNotFoundError:
        print(f'错误: 文件 {filename} 未找到。')
        sys.exit(1)
    except Exception as e:
        print(f'检查过程中发生错误: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()