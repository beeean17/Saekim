22101197_윤성빈_실습2_순차탐색과 이진탐색 2.md
2025-09-16
1 / 2
```cpp
#include<iostream>
#include<vector>
using namespace std;

void sequentialSearch(vector<int>& arr, int target){
    for(int i = 0; i < arr.size(); i++){
        cout << i;  // 확인하는 인덱스 출력
        if(arr[i] == target) {
            cout << endl;
            return;  // 찾은 경우 종료
        }
        if(i != arr.size() - 1) cout << " ";  // 마지막이 아닐 때만 공백
    }
    cout << endl;  // 찾지 못한 경우
}

void binarySearch(vector<int>& arr, int target) {
    int low = 0;
    int high = arr.size() - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2;
        cout << mid;  // 확인하는 중간 인덱스 출력

        if (arr[mid] == target) {
            cout << endl;
            return;  // 찾은 경우 종료
        }
        else if (arr[mid] < target) {
            low = mid + 1;  // 오른쪽 반 탐색 9
        }
        else {
            high = mid - 1;  // 왼쪽 반 탐색
        }
        if(mid != arr.size() - 1) cout << " ";  // 마지막이 아닐 때만 공백
    }
    cout << endl;  // 찾지 못한 경우
}

int main()
{
    int N, x;
    cin >> N >> x;

    vector<int> A;

    for(int i = 0; i < N; i++) {
        A.push_back(i);
    }
    sequentialSearch(A, x);    // 순차 탐색 실행
    binarySearch(A, x);        // 이진 탐색 실행
```
22101197_윤성빈_실습2_순차탐색과 이진탐색 2.md
2025-09-16
2 / 2
```
    return 0;
}
```

|  |
| --- |
| 22101197_윤성빈_실습2_순차탐색과 이진탐색 2.md 2025-09-16 return 0; } |

|  |
| --- |
| 2101197_윤성빈_실습2_순차탐색과 이진탐색 2.md 2025-09-1 return 0; } |