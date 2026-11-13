import "../components.css";
import React from "react";
import { useRef, useLayoutEffect, useState } from "react";
import { Button } from "../Button/Button";
export function Conversation({
  messages = [],
  label = "Session conversation",
}) {
  const ref = useRef(null);
  const following = useRef(true);
  const [unread, setUnread] = useState(false);
  // Upsert repeated IDs while retaining first-seen order, allowing streamed content updates.
  const unique = [
    ...new Map(messages.map((message) => [message.id, message])).values(),
  ];
  const revision = unique
    .map((message) => `${message.id}:${message.content}`)
    .join("|");
  useLayoutEffect(() => {
    if (following.current) {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
      setUnread(false);
    } else setUnread(true);
  }, [revision]);
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
          following.current =
            node.scrollHeight - node.clientHeight - node.scrollTop < 8;
          if (following.current) setUnread(false);
        }}
      >
        <ol>
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
