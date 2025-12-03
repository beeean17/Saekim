이 파일은 새김 마크다운 에디터에서 지원하는 모든 프로그래밍 언어의 구문 강조를 테스
트하기 위한 파일입니다.
## 1. Python
```python
def fibonacci(n):
    """피보나치 수열 생성"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib
# 클래스 예제
class Calculator:
    def __init__(self, value=0):
        self.value = value
    def add(self, x):
        self.value += x
        return self
print(fibonacci(10))
```
## 2. JavaScript
```javascript
// ES6+ 문법 예제
const greet = (name) => {
    return `Hello, ${name}!`;
};
// 비동기 함수
async function fetchData(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}
// 클래스
class User {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }
    getInfo() {
        return `{this.email}>`;
    }
}
const user = new User('John Doe', 'john@example.com');
```
## 3. TypeScript
```typescript
// 인터페이스 정의
interface Person {
    name: string;
    age: number;
    email?: string;
}
// 제네릭 함수
function identity<T>(arg: T): T {
    return arg;
}
// 타입 별칭
type Point = {
    x: number;
    y: number;
};
// 클래스
class Animal {
    constructor(public name: string) {}
    move(distance: number = 0): void {
        console.log(`{distance}m.`);
    }
}
class Dog extends Animal {
    bark(): void {
        console.log('Woof! Woof!');
    }
}
```
## 4. Java
```java
import java.util.*;
public class BinarySearch {
    public static int search(int[] arr, int target) {
        int left = 0, right = arr.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (arr[mid] == target) {
                return mid;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return -1;
    }
    public static void main(String[] args) {
        int[] numbers = {1, 3, 5, 7, 9, 11, 13};
        System.out.println("Index: " + search(numbers, 7));
    }
}
```
## 5. C++
```cpp
#include <iostream>
#include <vector>
#include <algorithm>
template<typename T>
class Stack {
private:
    std::vector<T> elements;
public:
    void push(const T& element) {
        elements.push_back(element);
    }
    T pop() {
        if (elements.empty()) {
            throw std::out_of_range("Stack is empty");
        }
        T element = elements.back();
        elements.pop_back();
        return element;
    }
    bool empty() const {
        return elements.empty();
    }
};
int main() {
    Stack<int> stack;
    stack.push(42);
    std::cout << "Popped: " << stack.pop() << std::endl;
    return 0;
}
```
## 6. C
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
// 구조체 정의
typedef struct Node {
    int data;
    struct Node* next;
} Node;
// 연결 리스트에 노드 추가
Node* append(Node* head, int value) {
    Node* newNode = (Node*)malloc(sizeof(Node));
    newNode->data = value;
    newNode->next = NULL;
    if (head == NULL) {
        return newNode;
    }
    Node* current = head;
    while (current->next != NULL) {
        current = current->next;
    }
    current->next = newNode;
    return head;
}
int main() {
    Node* list = NULL;
    list = append(list, 10);
    list = append(list, 20);
    printf("Linked list created\n");
    return 0;
}
```
## 7. C#
```csharp
using System;
using System.Collections.Generic;
using System.Linq;
namespace SyntaxTest
{
    public interface IRepository<T>
    {
        void Add(T item);
        T Get(int id);
        IEnumerable<T> GetAll();
    }
    public class Product
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Price { get; set; }
        public override string ToString()
        {
            return {Price}";
        }
    }
    class Program
    {
        static void Main(string[] args)
        {
            var products = new List<Product>
            {
                new Product { Id = 1, Name = "Laptop", Price = 999.99m },
                new Product { Id = 2, Name = "Mouse", Price = 29.99m }
            };
            var expensive = products.Where(p => p.Price > 100).ToList();
            Console.WriteLine($"Found {expensive.Count} expensive items");
        }
    }
}
```
## 8. Go
```go
package main
import (
    "fmt"
    "sync"
)
// 인터페이스 정의
type Shape interface {
    Area() float64
    Perimeter() float64
}
// 구조체
type Rectangle struct {
    Width  float64
    Height float64
}
func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}
func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}
// 고루틴 예제
func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        fmt.Printf("Worker %d processing job %d\n", id, job)
        results <- job * 2
    }
}
func main() {
    rect := Rectangle{Width: 10, Height: 5}
    fmt.Printf("Area: %.2f\n", rect.Area())
}
```
## 9. Rust
```rust
use std::collections::HashMap;
// 열거형
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}
// 구조체
struct User {
    username: String,
    email: String,
    sign_in_count: u64,
    active: bool,
}
impl User {
    fn new(username: String, email: String) -> User {
        User {
            username,
            email,
            sign_in_count: 1,
            active: true,
        }
    }
}
// 제네릭 함수
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}
fn main() {
    let numbers = vec![34, 50, 25, 100, 65];
    println!("The largest number is {}", largest(&numbers));
}
```
## 10. Ruby
```python
# 클래스 정의
class Person
  attr_accessor :name, :age
  def initialize(name, age)
    @name = name
    @age = age
  end
  def introduce
    puts "Hi, I'm #{@name} and I'm #{@age} years old."
  end
end
# 모듈
module Greetings
  def say_hello
    puts "Hello!"
  end
end
# 배열과 해시
fruits = ['apple', 'banana', 'cherry']
prices = { apple: 1.20, banana: 0.50, cherry: 2.00 }
# 블록과 이터레이터
fruits.each do |fruit|
  puts "I like #{fruit}s"
end
# 메타프로그래밍
5.times { |i| puts "Iteration #{i}" }
```
## 11. PHP
```sql
<?php
namespace App\Controllers;
use App\Models\User;
class UserController
{
    private $db;
    public function __construct($database)
    {
        database;
    }
    public function getUsers(): array
    {
        $query = "SELECT * FROM users WHERE active = ?";
        this->db->prepare($query);
        $stmt->execute([1]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    public function createUser(array $data): bool
    {
        data['name'], $data['email']);
        return $user->save();
    }
}
// 익명 함수
name) {
    return "Hello, {$name}!";
};
echo $greet("World");
?>
```
## 12. Swift
```python
import Foundation
// 프로토콜
protocol Drawable {
    func draw()
}
// 구조체
struct Point {
    var x: Double
    var y: Double
}
// 클래스
class Circle: Drawable {
    var center: Point
    var radius: Double
    init(center: Point, radius: Double) {
        self.center = center
        self.radius = radius
    }
    func draw() {
        print("Drawing circle at (\(center.x), \(center.y))")
    }
    func area() -> Double {
        return Double.pi * radius * radius
    }
}
// 옵셔널과 가드
func processUser(name: String?) {
    guard let userName = name else {
        print("No name provided")
        return
    }
    print("Processing user: \(userName)")
}
// 클로저
let numbers = [1, 2, 3, 4, 5]
let doubled = numbers.map { $0 * 2 }
```
## 13. Kotlin
```python
// 데이터 클래스
data class User(
    val id: Int,
    val name: String,
    val email: String
)
// 확장 함수
fun String.isPalindrome(): Boolean {
    return this == this.reversed()
}
// 실드 클래스
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
// 고차 함수
fun <T> List<T>.customFilter(predicate: (T) -> Boolean): List<T> {
    val result = mutableListOf<T>()
    for (item in this) {
        if (predicate(item)) {
            result.add(item)
        }
    }
    return result
}
fun main() {
    val users = listOf(
        User(1, "Alice", "alice@example.com"),
        User(2, "Bob", "bob@example.com")
    )
    // 람다
    users.forEach { user ->
        println("{user.email}")
    }
}
```
## 14. HTML
```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>샘플 페이지</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <nav class="navbar">
            <ul>
                <li><a href="#home">홈</a></li>
                <li><a href="#about">소개</a></li>
                <li><a href="#contact">연락처</a></li>
            </ul>
        </nav>
    </header>
    <main>
        <section id="hero">
            <h1>웹 개발의 세계에 오신 것을 환영합니다</h1>
            <p>HTML, CSS, JavaScript로 멋진 웹사이트를 만들어보세요.</p>
            <button onclick="handleClick()">시작하기</button>
        </section>
        <article>
            <h2>최신 소식</h2>
            <p>Lorem ipsum dolor sit amet...</p>
        </article>
    </main>
    <footer>
        <p>&copy; 2024 My Website. All rights reserved.</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>
```
## 15. CSS

---

```css
/* 중첩 선택자와 의사 클래스 */
.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    padding: var(--spacing);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
.navbar ul {
    list-style: none;
    display: flex;
    gap: 2rem;
}
.navbar a {
    color: white;
    text-decoration: none;
    transition: all 0.3s ease;
}
.navbar a:hover {
    transform: translateY(-2px);
    opacity: 0.8;
}
/* Grid 레이아웃 */
.grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    padding: 2rem;
}
.fade-in {
    animation: fadeIn 0.5s ease-in;
}
/* 미디어 쿼리 */
@media (max-width: 768px) {
    .navbar {
        flex-direction: column;
    }
}
```
## 16. SCSS

---

```css
// 믹스인
@mixin flex-center {
    display: flex;
    justify-content: center;
    align-items: center;
}
@mixin respond-to($breakpoint) {
    @if $breakpoint == mobile {
        @media (max-width: 768px) { @content; }
    } @else if $breakpoint == tablet {
        @media (min-width: 769px) and (max-width: 1024px) { @content; }
    }
}
// 중첩과 부모 참조
.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    &__header {
        font-size: 1.5rem;
        color: $primary-color;
        margin-bottom: 1rem;
    }
    &__body {
        line-height: 1.6;
    }
    &:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        transform: translateY(-2px);
        transition: all 0.3s ease;
    }
}
// 함수
@function calculate-rem($size) {
    @return $size / 16px * 1rem;
}
    cursor: pointer;
}
.btn-primary {
    @extend %button-base;
    background: $primary-color;
    color: white;
}
```
## 17. XML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bookstore xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <book category="web" isbn="978-0-596-52926-0">
        <title lang="en">Learning XML</title>
        <author>Erik T. Ray</author>
        <year>2003</year>
        <price currency="USD">39.95</price>
        <description>
            <![CDATA[
                A comprehensive guide to XML and related technologies.
            ]]>
        </description>
    </book>
    <book category="programming" isbn="978-0-134-68599-1">
        <title lang="en">Clean Code</title>
        <author>Robert C. Martin</author>
        <year>2008</year>
        <price currency="USD">44.99</price>
        <tags>
            <tag>programming</tag>
            <tag>best-practices</tag>
            <tag>software-engineering</tag>
        </tags>
    </book>
</bookstore>
```
## 18. JSON
```json
{
  "user": {
    "id": 12345,
    "username": "john_doe",
    "email": "john@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "age": 30,
      "address": {
        "street": "123 Main St",
        "city": "Seoul",
        "country": "South Korea",
        "postalCode": "12345"
      }
    },
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "language": "ko"
    },
    "roles": ["user", "admin"],
    "metadata": {
      "createdAt": "2024-01-15T09:30:00Z",
      "lastLogin": "2024-11-16T14:22:33Z",
      "isActive": true,
      "loginCount": 142
    }
  },
  "posts": [
    {
      "id": 1,
      "title": "First Post",
      "content": "Hello World!",
      "tags": ["introduction", "welcome"],
      "likes": 42
    },
    {
      "id": 2,
      "title": "Second Post",
      "content": "Learning JSON",
      "tags": ["json", "tutorial"],
      "likes": 89
    }
  ]
}
```
## 19. YAML

---

```yaml
    이것은 여러 줄에 걸친
    설명입니다.
database:
  host: localhost
  port: 5432
  name: mydb
  credentials:
    username: admin
    password: !secret database_password
  pool:
    min: 5
    max: 20
    timeout: 30
# 서버 설정
servers:
  - name: production
    url: https://prod.example.com
    region: ap-northeast-2
    replicas: 3
  - name: staging
    url: https://staging.example.com
    region: ap-northeast-2
    replicas: 1
# 기능 플래그
features:
  darkMode: true
  betaFeatures: false
  analytics:
    enabled: true
    provider: google
# 리스트
users:
  - id: 1
    name: Alice
    roles: [admin, user]
  - id: 2
    name: Bob
    roles: [user]
api:
  <<: *defaults
  endpoint: /api/v1
```
## 20. Markdown
```
# 마크다운 문법 예제
## 텍스트 스타일링
**굵게** 또는 __굵게__
*기울임* 또는 _기울임_
***굵게 기울임***
~~취소선~~
`인라인 코드`
## 목록
### 순서 없는 목록
- 항목 1
- 항목 2
  - 하위 항목 2.1
  - 하위 항목 2.2
### 순서 있는 목록
1. 첫 번째
2. 두 번째
3. 세 번째
## 링크와 이미지
[링크 텍스트](https://example.com)
![이미지 설명](image.png)
## 인용구
> 이것은 인용구입니다.
> 여러 줄에 걸칠 수 있습니다.
## 테이블
| 헤더1 | 헤더2 | 헤더3 |
|-------|:-----:|------:|
| 왼쪽  | 중앙  | 오른쪽 |
| 정렬  | 정렬  | 정렬   |
## 체크박스
- [x] 완료된 작업
- [ ] 미완료 작업
```
## 21. SQL

---

```sql
-- 테이블 생성
CREATE TABLE employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    department_id INT,
    salary DECIMAL(10, 2),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (department_id) REFERENCES departments(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    manager_id INT,
    budget DECIMAL(15, 2)
);
-- 인덱스 생성
CREATE INDEX idx_employee_email ON employees(email);
CREATE INDEX idx_department_name ON departments(name);
-- 데이터 삽입
INSERT INTO departments (name, budget) VALUES
    ('Engineering', 1000000.00),
    ('Sales', 500000.00),
    ('Marketing', 300000.00);
INSERT INTO employees (first_name, last_name, email, department_id, salary, hire_date)
VALUES
    ('John', 'Doe', 'john.doe@company.com', 1, 85000.00, '2023-01-15'),
    ('Jane', 'Smith', 'jane.smith@company.com', 1, 92000.00, '2022-06-01');
WHERE e.is_active = TRUE
    AND e.hire_date >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
ORDER BY e.salary DESC
LIMIT 10;
-- 집계 함수
SELECT
    d.name,
    COUNT(e.id) AS employee_count,
    AVG(e.salary) AS avg_salary,
    MAX(e.salary) AS max_salary
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id
GROUP BY d.id, d.name
HAVING COUNT(e.id) > 0;
-- 서브쿼리
UPDATE employees
SET salary = salary * 1.10
WHERE department_id IN (
    SELECT id FROM departments WHERE budget > 500000
);
-- 뷰 생성
CREATE VIEW high_earners AS
SELECT first_name, last_name, salary, department_id
FROM employees
WHERE salary > 80000;
-- 트랜잭션
START TRANSACTION;
UPDATE employees SET salary = salary + 5000 WHERE id = 1;
UPDATE departments SET budget = budget - 5000 WHERE id = 1;
COMMIT;
```
## 22. Bash

---

```bash
# 변수 정의
APP_NAME="MyApp"
VERSION="1.0.0"
LOG_DIR="/var/log/${APP_NAME}"
CONFIG_FILE="/etc/${APP_NAME}/config.conf"
# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
# 함수 정의
log_info() {
    echo -e "{NC} $1"
}
log_error() {
    echo -e "{NC} $1" >&2
}
log_warn() {
    echo -e "{NC} $1"
}
# 디렉토리 존재 확인
check_directory() {
    if [ ! -d "$1" ]; then
        log_warn "Directory $1 does not exist. Creating..."
        mkdir -p "$1"
        if [ $? -eq 0 ]; then
            log_info "Directory created successfully"
        else
            log_error "Failed to create directory"
            return 1
        fi
    fi
}
# 배열 사용
declare -a SERVICES=("nginx" "mysql" "redis")
# 파일 처리
process_logs() {
    local log_file="$1"
    if [ ! -f "$log_file" ]; then
        log_error "Log file not found: $log_file"
        return 1
    fi
    # 최근 10줄 읽기
    tail -n 10 "$log_file"
    # 에러 카운트
    local error_count=log_file")
    log_info "Total errors: $error_count"
}
# 조건문
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root"
    exit 1
fi
# Case 문
case "$1" in
    start)
        log_info "Starting $APP_NAME..."
        ;;
    stop)
        log_info "Stopping $APP_NAME..."
        ;;
    restart)
        log_info "Restarting $APP_NAME..."
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
# 파일 백업
backup_config() {
    local backup_file="(date +%Y%m%d_%H%M%S)"
    cp "backup_file"
    log_info "Backup created: $backup_file"
}
}
main "$@"
```
## 23. Shell
```bash
#!/bin/sh
# POSIX 호환 셸 스크립트
set -e  # 에러 발생 시 종료
set -u  # 미정의 변수 사용 시 에러
# 변수
PROJECT_DIR="/opt/myproject"
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d)
# 함수
print_msg() {
    printf "[%s] %s\n" "1"
}
# 디렉토리 생성
create_dirs() {
    for dir in "BACKUP_DIR"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_msg "Created directory: $dir"
        fi
    done
}
# 파일 확인 및 백업
backup_files() {
    cd "$PROJECT_DIR" || exit 1
    for file in *.conf; do
        if [ -f "$file" ]; then
            cp "{BACKUP_DIR}/{DATE}"
            print_msg "Backed up: $file"
        fi
    done
}
# 실행
create_dirs
backup_files
print_msg "Backup completed"
```
## 24. PowerShell

---

```
# 파라미터 정의
param(
    [Parameter(Mandatory=$true)]
    [string]$Environment,
    [Parameter(Mandatory=$false)]
    [int]$MaxRetries = 3,
    [switch]$Verbose
)
# 엄격 모드
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
# 함수 정의
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("Info", "Warning", "Error")]
        [string]$Level = "Info"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Level) {
        "Info"    { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }
    Write-Host "[Level] color
}
# 클래스 정의
class Server {
    [string]$Name
    [string]$IPAddress
    [int]$Port
    Server([string]ip, [int]$port) {
        name
        ip
        port
    }
    [bool] IsReachable() {
        return Test-Connection -ComputerName $this.IPAddress -Count 1 -Quiet
    }
}
    AppName = "MyApp"
    Version = "2.0.0"
    Servers = @(
        [Server]::new("Web01", "192.168.1.10", 80)
        [Server]::new("DB01", "192.168.1.20", 5432)
    )
}
# 배열 처리
$servers = @("web1", "web2", "db1")
$servers | ForEach-Object {
    Write-Log "Processing server: $_" -Level Info
}
# 파일 처리
Get-ChildItem -Path "C:\Logs" -Filter "*.log" |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-7) } |
    ForEach-Object {
        Write-Log "Found recent log: _.Name)"
    }
# Try-Catch
try {
    $result = Invoke-RestMethod -Uri "https://api.example.com/data" -Method Get
    Write-Log "API call successful" -Level Info
}
catch {
    Write-Log "API call failed: _.Exception.Message)" -Level Error
    throw
}
# 조건문
if ($Environment -eq "Production") {
    Write-Log "Running in production mode" -Level Warning
}
elseif ($Environment -eq "Staging") {
    Write-Log "Running in staging mode" -Level Info
}
else {
    Write-Log "Unknown environment: $Environment" -Level Error
    exit 1
}
# 파이프라인과 필터링
Get-Process |
    Where-Object { $_.CPU -gt 100 } |
    Sort-Object CPU -Descending |
    Select-Object -First 5 Name, CPU, WorkingSet
Write-Log "Script completed successfully" -Level Info
```
## 25. Dockerfile

---

```bash
# 메타데이터
LABEL maintainer="dev@example.com"
LABEL version="1.0"
LABEL description="Production-ready Node.js application"
# 작업 디렉토리 설정
WORKDIR /app
# 의존성 파일 복사
COPY package*.json ./
# 의존성 설치
RUN npm ci --only=production && \
    npm cache clean --force
# 소스 코드 복사
COPY . .
# 빌드
RUN npm run build
# 프로덕션 스테이지
FROM node:18-alpine
# 보안: non-root 사용자 생성
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
# 빌더 스테이지에서 필요한 파일만 복사
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
# 환경 변수 설정
ENV NODE_ENV=production \
    PORT=3000
# 사용자 전환
USER nodejs
# 포트 노출
EXPOSE 3000
# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js
VOLUME ["/app/logs", "/app/uploads"]
# 실행
CMD ["node", "dist/index.js"]
# 선택적: ENTRYPOINT 예제
# ENTRYPOINT ["docker-entrypoint.sh"]
```
## 26. Nginx

---

```css
# 사용자 및 워커 프로세스
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;
# 이벤트 블록
events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}
http {
    # 기본 설정
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    # 로그 형식
    log_format main 'remote_user [request" '
                    'body_bytes_sent "$http_referer" '
                    '"http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    # 성능 최적화
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;
    # Gzip 압축
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/x-font-ttf font/opentype image/svg+xml;
    # 업스트림 서버 정의
    upstream backend {
        least_conn;
        server backend1.example.com:8080 weight=3;
        server backend2.example.com:8080 weight=2;
        server backend3.example.com:8080 backup;
    }
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    # HTTP -> HTTPS 리다이렉트
    server {
        listen 80;
        server_name example.com www.example.com;
        return 301 https://request_uri;
    }
    # HTTPS 서버
    server {
        listen 443 ssl http2;
        server_name example.com www.example.com;
        # SSL 인증서
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        # 루트 디렉토리
        root /var/www/html;
        index index.html index.htm;
        # 정적 파일 캐싱
        location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        # API 프록시
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            # 타임아웃
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        # SPA 라우팅
        location / {
            try_files uri/ /index.html;
        }
        add_header X-XSS-Protection "1; mode=block" always;
        # 에러 페이지
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
```
## 27. R

---

```
# 라이브러리 로드
library(dplyr)
library(ggplot2)
library(tidyr)
# 데이터 생성
set.seed(123)
data <- data.frame(
  id = 1:100,
  age = sample(18:65, 100, replace = TRUE),
  income = rnorm(100, mean = 50000, sd = 15000),
  category = sample(c("A", "B", "C"), 100, replace = TRUE)
)
# 함수 정의
calculate_stats <- function(x) {
  list(
    mean = mean(x, na.rm = TRUE),
    median = median(x, na.rm = TRUE),
    sd = sd(x, na.rm = TRUE),
    min = min(x, na.rm = TRUE),
    max = max(x, na.rm = TRUE)
  )
}
# dplyr 파이프라인
summary_data <- data %>%
  filter(age >= 25) %>%
  group_by(category) %>%
  summarise(
    count = n(),
    avg_income = mean(income),
    median_income = median(income),
    sd_income = sd(income)
  ) %>%
  arrange(desc(avg_income))
  )
# 통계 모델
model <- lm(income ~ age + category, data = data)
summary(model)
# 조건문
if (nrow(data) > 50) {
  print("Large dataset")
} else {
  print("Small dataset")
}
# 반복문
for (cat in unique(data$category)) {
  cat_data <- data[data$category == cat, ]
  cat(sprintf("Category %s: n=%d, mean income=%.2f\n",
              cat, nrow(cat_data), mean(cat_data$income)))
}
# Apply 계열 함수
income_stats <- lapply(split(datacategory), calculate_stats)
print(income_stats)
```
## 28. MATLAB

---

```
% 변수 정의
clear all;
close all;
clc;
% 매개변수
n = 100;
t = linspace(0, 2*pi, n);
% 함수 정의
function y = custom_function(x, a, b)
    % 사용자 정의 함수
    y = a * sin(b * x) + cos(x);
end
% 행렬 연산
A = rand(5, 5);
B = eye(5);
C = A * B;
eigenvalues = eig(A);
% 벡터화 연산
x = 0:0.1:10;
y1 = custom_function(x, 2, 3);
y2 = exp(-x/5) .* cos(x);
% 플로팅
figure('Position', [100, 100, 1200, 400]);
subplot(1, 3, 1);
plot(x, y1, 'b-', 'LineWidth', 2);
hold on;
plot(x, y2, 'r--', 'LineWidth', 2);
grid on;
xlabel('X axis');
ylabel('Y axis');
title('Function Comparison');
legend('Function 1', 'Function 2', 'Location', 'best');
subplot(1, 3, 2);
[X, Y] = meshgrid(-5:0.1:5, -5:0.1:5);
Z = sin(sqrt(X.^2 + Y.^2));
surf(X, Y, Z);
colormap('jet');
colorbar;
xlabel('X');
ylabel('Y');
zlabel('Z');
title('3D Surface Plot');
shading interp;
subplot(1, 3, 3);
histogram(randn(1000, 1), 50, 'FaceColor', 'blue', 'EdgeColor', 'black');
title('Normal Distribution');
xlabel('Value');
ylabel('Frequency');
% 조건문
if max(eigenvalues) > 1
    disp('Matrix has eigenvalues greater than 1');
else
    disp('All eigenvalues are <= 1');
end
% 반복문
for i = 1:5
    fprintf('Iteration %d: Value = %.4f\n', i, eigenvalues(i));
end
% 수치 적분
f = @(x) x.^2 .* sin(x);
integral_result = integral(f, 0, pi);
fprintf('Integral result: %.6f\n', integral_result);
% 미분방정식 (ODE)
dydt = @(t, y) -2*y + sin(t);
[t_ode, y_ode] = ode45(dydt, [0 10], 1);
figure;
plot(t_ode, y_ode, 'LineWidth', 2);
grid on;
title('ODE Solution');
xlabel('Time');
ylabel('y(t)');
% 저장
% save('workspace.mat');
disp('Script completed successfully');
```
## 29. LaTeX

---

```python
% 패키지
\usepackage[utf8]{inputenc}
\usepackage[korean]{babel}
\usepackage{amsmath, amssymb, amsthm}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{listings}
\usepackage{xcolor}
% 코드 스타일 정의
\lstset{
    language=Python,
    basicstyle=\ttfamily\small,
    keywordstyle=\color{blue},
    commentstyle=\color{green!50!black},
    stringstyle=\color{red},
    numbers=left,
    numberstyle=\tiny,
    frame=single,
    breaklines=true
}
% 정리 환경
\newtheorem{theorem}{정리}[section]
\newtheorem{lemma}[theorem]{보조정리}
\newtheorem{definition}{정의}[section]
% 문서 정보
\title{\textbf{수학 및 알고리즘 문서}}
\author{홍길동}
\date{\today}
\begin{document}
\maketitle
\begin{abstract}
이 문서는 LaTeX의 다양한 기능을 시연하기 위한 예제입니다.
수식, 정리, 코드, 그림 등을 포함합니다.
\end{abstract}
\section{서론}
LaTeX는 고품질의 조판 시스템입니다. 특히 수학 수식 표현에 뛰어납니다.
\section{수학 수식}
\subsection{인라인 수식}
피타고라스의 정리:
Einstein의 질량-에너지 등가:
\subsection{블록 수식}
이차 방정식의 해:
\begin{equation}
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
\end{equation}
행렬 표현:
\begin{equation}
A = \begin{pmatrix}
a_{11} & a_{12} & a_{13} \\
a_{21} & a_{22} & a_{23} \\
a_{31} & a_{32} & a_{33}
\end{pmatrix}
\end{equation}
적분:
\begin{equation}
\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
\end{equation}
합:
\begin{equation}
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
\end{equation}
\section{정리와 증명}
\begin{theorem}[피타고라스 정리]
직각삼각형에서 빗변의 제곱은 다른 두 변의 제곱의 합과 같다.
\end{theorem}
\begin{proof}
기하학적 방법을 사용하여 증명할 수 있다.
\[
a^2 + b^2 = c^2
\]
\end{proof}
\begin{definition}
함수 가 점 에서 \textbf{연속}이라는 것은
\[
\lim_{x \to x_0} f(x) = f(x_0)
\]
를 만족하는 것이다.
\end{definition}
\section{코드 삽입}
다음은 Python 코드 예제입니다:
def fibonacci(n):
    """피보나치 수열 생성"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib
print(fibonacci(10))
\end{lstlisting}
\section{리스트}
\subsection{순서 없는 리스트}
\begin{itemize}
    \item 첫 번째 항목
    \item 두 번째 항목
    \begin{itemize}
        \item 하위 항목 1
        \item 하위 항목 2
    \end{itemize}
    \item 세 번째 항목
\end{itemize}
\subsection{순서 있는 리스트}
\begin{enumerate}
    \item 첫 번째 단계
    \item 두 번째 단계
    \item 세 번째 단계
\end{enumerate}
\section{표}
\begin{table}[h]
\centering
\begin{tabular}{|c|c|c|}
\hline
\textbf{알고리즘} & \textbf{시간 복잡도} & \textbf{공간 복잡도} \\
\hline
선형 탐색 &  &  \\
이진 탐색 &  &  \\
퀵 정렬 &  &  \\
\hline
\end{tabular}
\caption{알고리즘 복잡도 비교}
\label{tab:complexity}
\end{table}
더 많은 정보는 \href{https://www.latex-project.org/}{LaTeX 프로젝트 웹사이트}를 참조하세요.
\end{document}
```
## 30. 추가: Mermaid 다이어그램

---

인라인 수식:
블록 수식:
## 테스트 체크리스트
Python 구문 강조
JavaScript 구문 강조
TypeScript 구문 강조
Java 구문 강조
```cpp
C++ 구문 강조 (vector, cout, string 등)
```
C 구문 강조 (malloc, printf, strlen 등)
C# 구문 강조
Go 구문 강조
Rust 구문 강조
Ruby 구문 강조
PHP 구문 강조
Swift 구문 강조
Kotlin 구문 강조
E=mc2E
=
mc^2
- E = mc2*
```
∫−∞∞e−x2dx=π\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
```
- e*
- dx =*
∫
−∞
∞
- −x2*
- π*
•
•
•
•
•
•
•
•
•
•
•
•
•

---

CSS 구문 강조
SCSS 구문 강조
XML 구문 강조
JSON 구문 강조
YAML 구문 강조
Markdown 구문 강조
SQL 구문 강조
Bash 구문 강조
Shell 구문 강조
PowerShell 구문 강조
Dockerfile 구문 강조
Nginx 구문 강조
R 구문 강조
MATLAB 구문 강조
LaTeX 구문 강조
Mermaid 다이어그램 렌더링
KaTeX 수식 렌더링
- *테스트 완료! 🎉**
```cpp
C/C++ 표준 라이브러리 강조 테스트:
std::vector , std::cout , std::string  → std 는 보라색, vector , cout , string
```
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

---