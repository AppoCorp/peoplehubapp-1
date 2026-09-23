import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleProxy(request);
}

export async function POST(request: NextRequest) {
  return handleProxy(request);
}

export async function PUT(request: NextRequest) {
  return handleProxy(request);
}

export async function PATCH(request: NextRequest) {
  return handleProxy(request);
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request);
}

async function handleProxy(request: NextRequest) {
  try {
    const baseUrl = request.headers.get('x-base-url');
    const targetPath = request.headers.get('x-target-path');
    
    if (!baseUrl || !targetPath) {
      return NextResponse.json(
        { message: 'Missing routing headers: x-base-url or x-target-path' },
        { status: 400 }
      );
    }

    // Standardize URL formatting
    let formattedBaseUrl = baseUrl.trim();
    if (!formattedBaseUrl.startsWith('http')) {
      formattedBaseUrl = `https://${formattedBaseUrl}`;
    }
    formattedBaseUrl = formattedBaseUrl.replace(/\/+$/, '');

    const targetUrl = `${formattedBaseUrl}${targetPath}`;

    const headers = new Headers();
    const auth = request.headers.get('authorization');
    if (auth) {
      headers.set('authorization', auth);
    }

    const contentType = request.headers.get('content-type') || '';
    
    let body: any = undefined;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      if (contentType.includes('multipart/form-data')) {
        // Parse incoming multipart request
        const incomingFormData = await request.formData();
        const outgoingFormData = new FormData();
        
        for (const [key, value] of incomingFormData.entries()) {
          if (value instanceof File) {
            // Forward the file correctly
            outgoingFormData.append(key, value, value.name);
          } else {
            outgoingFormData.append(key, value);
          }
        }
        
        body = outgoingFormData;
        // Notice: Do NOT set Content-Type header manually for multipart requests!
        // Fetch will automatically generate the correct boundary.
      } else {
        const text = await request.text();
        if (text && text.trim().length > 0) {
          headers.set('content-type', 'application/json');
          body = text;
        }
      }
    }

    // Call the target HRMS endpoint server-side (bypassing CORS)
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });

    const dataText = await res.text();
    let data;
    try {
      data = JSON.parse(dataText);
    } catch {
      data = dataText;
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal proxy router error' },
      { status: 500 }
    );
  }
}
