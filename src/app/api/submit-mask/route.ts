import { NextResponse } from 'next/server';

interface PhotoResponse {
  status: string;
  message: string;
  data?: any;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const apiUrl = process.env.BACKEND_API_URL;
    
    if (!apiUrl) {
      throw new Error('Backend API URL not found');
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.API_KEY || ''
      },
      body: JSON.stringify(data)
    });
    console.log('body', data);

    const result: PhotoResponse = await response.json();
    
    // 如果状态码不是200，返回错误
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: result.message || 'Server error'
      }, { status: response.status });
    }

    // 检查响应状态
    if (result.status !== 'success') {
      return NextResponse.json({
        success: false,
        error: result.message || 'Operation failed'
      });
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Submit mask error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit mask'
    }, { status: 500 });
  }
} 