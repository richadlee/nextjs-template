import { NextResponse } from 'next/server';
import crypto from 'crypto';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function base62Decode(data: string): Uint8Array {
  // 将 Base62 字符串转换为 BigInt
  let num = 0n;
  const base = BigInt(BASE62.length);
  
  for (const char of data) {
    num = num * base + BigInt(BASE62.indexOf(char));
  }
  
  // 转换为字节数组
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xFFn));
    num = num >> 8n;
  }
  
  // 如果字节数组为空，返回一个包含 0 的数组
  if (bytes.length === 0) {
    return new Uint8Array([0]);
  }
  
  return new Uint8Array(bytes);
}

function getKey(key: string): Uint8Array {
  // 使用 SHA-256 生成密钥
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(key, 'utf8'));
  return new Uint8Array(hash.digest());
}

function xorData(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = getKey(key);
  const result = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return result;
}

function decrypt(ciphertext: string, key: string): string {
  try {
    console.log('Input ciphertext:', ciphertext);
    console.log('Using key:', key);
    
    // Base62 解码
    const data = base62Decode(ciphertext);
    console.log('Decoded bytes:', Array.from(data));
    
    // XOR 解密
    const decrypted = xorData(data, key);
    console.log('Decrypted bytes:', Array.from(decrypted));
    
    // 转换为文本
    const text = new TextDecoder().decode(decrypted);
    console.log('Decrypted text:', text);
    
    return text;
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    console.log('Received token:', token);
    
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key not found');
    }
    
    const decrypted = decrypt(token, key);
    const parts = decrypted.split(' ');
    
    if (parts.length !== 8) {
      throw new Error(`Invalid decrypted data format. Expected 8 parts, got ${parts.length}`);
    }
    
    const [
      botToken,
      userId,
      userLang,
      photoType,
      photoNumber,
      fileUniId,
      tgMessageId,
      imageCostCredits
    ] = parts;

    const result = {
      success: true,
      data: {
        botToken,
        userId: parseInt(userId),
        userLang,
        photoType,
        photoNumber,
        fileUniId,
        tgMessageId: parseInt(tgMessageId),
        imageCostCredits: parseFloat(imageCostCredits)
      }
    };
    
    console.log('Final result:', result);
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Invalid token'
    }, { status: 400 });
  }
}