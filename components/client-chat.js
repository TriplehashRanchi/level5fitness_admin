"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { chatPathOf } from "@/lib/chat-inbox";
import ChatPanel from "@/components/chat/chat-panel";
import { Section } from "@/components/ui";

/**
 * The dietitian's chat with one client, as a section of the client page: the same live conversation
 * as on the Messages page. Nothing is loaded (and nothing is marked as read) until the section has
 * actually been scrolled into view.
 */
export default function ClientChat({ memberId, name, image }) {
  const rootRef = useRef(null);
  /** On screen right now. */
  const [inView, setInView] = useState(false);
  /** Has been on screen at least once. */
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setOpened(true);
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const who = name || "the client";
  return (
    <div ref={rootRef}>
      <Section
        id="chat"
        title="Chat"
        description={`Messages with ${who}. They see them in the app and get a notification.`}
        action={
          <Link href={`/messages?with=${encodeURIComponent(memberId)}`} className="rounded-full border border-line bg-card-2 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-brand/40 hover:text-brand">
            Open in Messages
          </Link>
        }
      >
        <div className="h-[32rem] overflow-hidden rounded-2xl border border-line bg-black/25">
          {opened ? (
            <ChatPanel
              key={memberId}
              className="h-full"
              convKey={memberId}
              path={chatPathOf("dietitian", memberId)}
              role="dietitian"
              name={who}
              image={image}
              note="Your client"
              active={inView}
              quickReplies
            />
          ) : null}
        </div>
      </Section>
    </div>
  );
}
