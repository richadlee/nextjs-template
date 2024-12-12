'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSignal, initData, postEvent, expandViewport  } from '@telegram-apps/sdk-react';
import { Button, Placeholder, Cell, Section, Accordion, Blockquote } from '@telegram-apps/telegram-ui';
import { MaskEditor } from '@/components/MaskEditor/MaskEditor';
import { Page } from '@/components/Page';
import { doc } from './doc';

interface DecryptedData {
  bot_token: string;
  user_id: number;
  photo_type: string;
  photo_number: string;
  file_uni_id: string;
  tg_message_id: number;
  image_cost_credits: number;
  effect_select_tg_message_id: number;
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
  const [expanded, setExpanded] = useState(false);


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
          image_cost_credits: decryptResult.data.imageCostCredits,
          effect_select_tg_message_id: decryptResult.data.effectSelectTgMessageId
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
          throw new Error('Failed to fetch image, please try to send another photo');
        }
        
        setImageUrl(imageResult.data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    init();
    expandViewport();
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
          effect_select_tg_message_id: decryptedData.effect_select_tg_message_id,
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
      <Page back={false}>
        <Placeholder header="Loading" description="Please wait..." />
      </Page>
    );
  }

  if (error) {
    return (
      <Page back={false}>
        <Placeholder
          header="Error"
          description={error}
        />
      </Page>
    );
  }

  return (
    <Page back={false}>
      {decryptedData && (
        <Section>
          <Cell
            before={<span style={{ fontSize: '20px' }}>👤</span>}
            multiline
            description={`PhotoType: ${decryptedData.photo_type} - ${decryptedData.image_cost_credits} CR`}
          >
            User ID: {decryptedData.user_id}
          </Cell>
        </Section>
      )}

    <Accordion
      expanded={expanded}
      onChange={(isExpanded) => setExpanded(isExpanded)}
      id=""
    > 
      <Accordion.Summary>
      💡 Usage Tips
      </Accordion.Summary>
      <Accordion.Content>
        <div
          style={{
            padding: '10px 20px 20px'
          }}
        >
          <p style={{fontSize: '14px'}}>
            {decryptedData?.photo_type && 
            Object.hasOwn(doc.en.tips, decryptedData.photo_type) ? 
            doc.en.tips[decryptedData.photo_type as keyof typeof doc.en.tips] : 
            ''}
          </p>
          <p style={{fontSize: '14px'}}>
            {doc.en.tips.title}
          </p>
        </div>
      </Accordion.Content>
    </Accordion>
          
      <MaskEditor
        imageUrl={imageUrl}
        onChange={(base64) => {
          setMaskBase64(base64);
        }}
      />
      
      <div style={{ padding: '16px', paddingBottom: '32px' }}>
        <Button
          size="l"
          onClick={handleSubmit}
          style={{ width: '100%' }}
        >
          📤 Submit Mask
        </Button>
      </div>

      {submitting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--tg-theme-bg-color)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <Section style={{ width: '90%', maxWidth: '400px' }}>
            {submitError ? (
              <>
                <Cell
                  before={<span style={{ fontSize: '20px' }}>❌</span>}
                  multiline
                >
                  {submitError}
                </Cell>
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <Button onClick={closeModal}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <Cell
                before={<span style={{ fontSize: '20px' }}>⏳</span>}
                description="Please wait while we submit your mask"
              >
                Processing...
              </Cell>
            )}
          </Section>
        </div>
      )}
    </Page>
  );
} 