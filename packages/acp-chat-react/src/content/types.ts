import type {
  ContentBlock,
  ResourceContentBlock,
  ResourceLinkContentBlock,
} from "@acp/chat-core";

export interface ContentRendererProps {
  blocks: ContentBlock[];
  className?: string;
}

export interface TextContentProps {
  text: string;
  className?: string;
}

export interface ResourceContentProps {
  block: ResourceContentBlock;
  className?: string;
}

export interface ResourceLinkContentProps {
  block: ResourceLinkContentBlock;
  className?: string;
}

export interface UnsupportedContentProps {
  type: string;
  className?: string;
}
