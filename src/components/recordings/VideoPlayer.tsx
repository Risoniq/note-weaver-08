import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";

interface VideoPlayerProps {
  videoUrl: string;
  className?: string;
}

export function VideoPlayer({ videoUrl, className }: VideoPlayerProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    const resolve = async () => {
      if (videoUrl.startsWith('storage:')) {
        setIsResolving(true);
        const [, bucket, ...pathParts] = videoUrl.split(':');
        const path = pathParts.join(':');
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        setResolvedUrl(data?.signedUrl || null);
        setIsResolving(false);
        return;
      }
      if (videoUrl.includes('/storage/v1/object/authenticated/')) {
        setIsResolving(true);
        const match = videoUrl.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
        if (match) {
          const { data } = await supabase.storage
            .from(match[1])
            .createSignedUrl(match[2], 3600);
          setResolvedUrl(data?.signedUrl || null);
        }
        setIsResolving(false);
        return;
      }
      setResolvedUrl(videoUrl);
    };
    resolve();
  }, [videoUrl]);

  if (isResolving || !resolvedUrl) {
    return (
      <div className={`aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center ${className ?? ''}`}>
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={`aspect-video bg-muted rounded-lg overflow-hidden ${className ?? ''}`}>
      <video src={resolvedUrl} controls className="w-full h-full" preload="metadata" />
    </div>
  );
}

export function useResolvedVideoUrl(videoUrl: string | null) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl) { setResolvedUrl(null); return; }
    const resolve = async () => {
      if (videoUrl.startsWith('storage:')) {
        const [, bucket, ...pathParts] = videoUrl.split(':');
        const { data } = await supabase.storage.from(bucket).createSignedUrl(pathParts.join(':'), 3600);
        setResolvedUrl(data?.signedUrl || null);
        return;
      }
      if (videoUrl.includes('/storage/v1/object/authenticated/')) {
        const match = videoUrl.match(/\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/);
        if (match) {
          const { data } = await supabase.storage.from(match[1]).createSignedUrl(match[2], 3600);
          setResolvedUrl(data?.signedUrl || null);
        }
        return;
      }
      setResolvedUrl(videoUrl);
    };
    resolve();
  }, [videoUrl]);

  return resolvedUrl;
}
