'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSignal, initData, postEvent } from '@telegram-apps/sdk-react';
import { Button, Placeholder } from '@telegram-apps/telegram-ui';
import { MaskEditor } from '@/components/MaskEditor/MaskEditor';
import { Page } from '@/components/Page';

interface DecryptedData {
  bot_token: string;
  user_id: number;
  photo_type: string;
  photo_number: string;
  file_uni_id: string;
  tg_message_id: number;
  image_cost_credits: number;
}

export default function MaskEditorPage() {
  const searchParams = useSearchParams();
  const initDataState = useSignal(initData.state);
  const [decryptedData, setDecryptedData] = useState<DecryptedData | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [maskBase64, setMaskBase64] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userId = initDataState?.user?.id;
    console.log('User ID:', userId);

    if (!token) {
      setError('Missing token parameter');
      setLoading(false);
      return;
    }

    if (!userId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    async function init() {
      try {
        // Decrypt token
        const decryptResponse = await fetch('/api/decrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        const decryptResult = await decryptResponse.json();
        if (!decryptResult.success) {
          throw new Error('Failed to decrypt token');
        }
        
        // Verify user
        if (decryptResult.data.userId !== userId) {
          throw new Error('User verification failed');
        }
        
        // Convert camelCase to snake_case
        const snakeCaseData: DecryptedData = {
          bot_token: decryptResult.data.botToken,
          user_id: decryptResult.data.userId,
          photo_type: decryptResult.data.photoType,
          photo_number: decryptResult.data.photoNumber,
          file_uni_id: decryptResult.data.fileUniId,
          tg_message_id: decryptResult.data.tgMessageId,
          image_cost_credits: decryptResult.data.imageCostCredits
        };
        
        setDecryptedData(snakeCaseData);
        
        // Get image
        const imageResponse = await fetch('/api/get-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: decryptResult.data.botToken,
            photoNumber: decryptResult.data.photoNumber
          })
        });
        
        const imageResult = await imageResponse.json();
        if (!imageResult.success) {
          throw new Error('Failed to fetch image');
        }
        
        setImageUrl(imageResult.data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    init();
  }, [searchParams, initDataState?.user?.id]);

  const handleSubmit = async () => {
    if (!decryptedData) return;

    if (!maskBase64) {
      setSubmitting(true);
      setSubmitError('Please draw a mask before submitting');
      return;
    }
    
    try {
      setSubmitting(true);
      setSubmitError(null);
      
      const base64Data = maskBase64.split(',')[1];
      console.log('Submitting mask base64:', {
        fullLength: maskBase64.length,
        dataLength: base64Data.length,
        prefix: maskBase64.substring(0, 50) + '...'
      });
      
      const response = await fetch('/api/submit-mask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: decryptedData.bot_token,
          user_id: decryptedData.user_id,
          photo_type: decryptedData.photo_type,
          photo_number: decryptedData.photo_number,
          file_uni_id: decryptedData.file_uni_id,
          tg_message_id: decryptedData.tg_message_id,
          image_cost_credits: decryptedData.image_cost_credits,
          is_mask_mode: true,
          mask_base64: base64Data
        })
      });
      
      const result = await response.json();

      if (result.success) {
        setSubmitting(false);
        postEvent('web_app_close');
      } else {
        setSubmitError(result.error || 'Failed to submit mask');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitError(err.message || 'Failed to submit mask');
    }
  };

  const closeModal = () => {
    setSubmitting(false);
    setSubmitError(null);
  };

  if (loading) {
    return (
      <Page>
        <Placeholder header="Loading" description="Please wait..." />
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <Placeholder
          header="Error"
          description={error}
        />
      </Page>
    );
  }

  return (
    <Page>
      <MaskEditor
        imageUrl={imageUrl}
        onChange={(base64) => {
          setMaskBase64(base64);
        }}
      />
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '16px',
        paddingBottom: '32px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Button 
          onClick={handleSubmit}
          style={{ 
            width: '200px',
            backgroundColor: '#ff4d4f',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 2px 0 rgba(0, 0, 0, 0.045)'
          }}
        >
          📤 Submit
        </Button>
      </div>
      {submitting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--tg-theme-bg-color)',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            minWidth: '300px',
            color: 'var(--tg-theme-text-color)',
            border: '1px solid var(--tg-theme-hint-color)'
          }}>
            {submitError ? (
              <>
                <div style={{ 
                  color: '#ff4d4f',
                  marginBottom: '16px',
                  wordBreak: 'break-word'
                }}>
                  ❌ {submitError}
                </div>
                <Button 
                  onClick={closeModal}
                  style={{ 
                    minWidth: '100px',
                    backgroundColor: 'var(--tg-theme-button-color)',
                    color: 'var(--tg-theme-button-text-color)',
                  }}
                >
                  Close
                </Button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '10px', color: 'var(--tg-theme-text-color)' }}>⏳ Processing...</div>
                <div style={{ color: 'var(--tg-theme-text-color)' }}>Please wait while we submit your mask</div>
              </>
            )}
          </div>
        </div>
      )}
    </Page>
  );
} 