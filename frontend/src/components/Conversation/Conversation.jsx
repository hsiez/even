import "../components.css";
import React from "react";
import { useRef, useLayoutEffect, useState } from "react";
import { Button } from "../Button/Button";
export function Conversation({
  messages = [],
  label = "Session conversation",
}) {
  const ref = useRef(null);
  const contentRef = useRef(null);
  const geometry = useRef(null);
  const following = useRef(true);
  const [unread, setUnread] = useState(false);
  // Upsert repeated IDs while retaining first-seen order, allowing streamed content updates.
  const unique = [
    ...new Map(messages.map((message) => [message.id, message])).values(),
  ];
  useLayoutEffect(() => {
    const log = ref.current;
    const content = contentRef.current;
    function onActivity() {
      if (following.current) {
        log.scrollTop = log.scrollHeight;
        setUnread(false);
      } else setUnread(true);
      geometry.current = {
        scrollHeight: log.scrollHeight,
        clientHeight: log.clientHeight,
      };
    }
    onActivity();
    // Observe rendered activity, including updates inside executionAction children.
    // React element identity is not a reliable signal of visible message changes.
    const mutations = new MutationObserver(onActivity);
    mutations.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    let previous = content.getBoundingClientRect();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const next = content.getBoundingClientRect();
            if (
              next.width !== previous.width ||
              next.height !== previous.height ||
              log.clientHeight !== geometry.current.clientHeight
            )
              onActivity();
            previous = next;
          });
    resize?.observe(content);
    resize?.observe(log);
    return () => {
      mutations.disconnect();
      resize?.disconnect();
    };
  }, []);
  function follow() {
    following.current = true;
    setUnread(false);
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }
  return (
    <section className="even-conversation" aria-label={label}>
      <div
        ref={ref}
        role="log"
        aria-label="Messages"
        aria-live="off"
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          // Layout/content growth can dispatch a scroll event before the resize
          // observer runs. Let it preserve our previous following intent first.
          if (
            typeof ResizeObserver !== "undefined" &&
            geometry.current &&
            (node.scrollHeight !== geometry.current.scrollHeight ||
              node.clientHeight !== geometry.current.clientHeight)
          )
            return;
          following.current =
            node.scrollHeight - node.clientHeight - node.scrollTop < 8;
          if (following.current) setUnread(false);
        }}
      >
        <ol ref={contentRef}>
          {unique.map((message) => (
            <li key={message.id}>
              <article aria-label={`${message.role} message`}>
                <h3>{message.role}</h3>
                <p>{message.content}</p>
                {message.executionAction}
              </article>
            </li>
          ))}
        </ol>
      </div>
      {unread && <Button onClick={follow}>Follow latest activity</Button>}
    </section>
  );
}
