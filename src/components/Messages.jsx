

export default function Messages({ messages }) {
  return (
    <div className="p-4 space-y-2 overflow-clip">
      {messages.map((msg, idx) => (
        <div key={idx} className="chat chat-end">
            <div className="chat chat-bubble-primary chat-bubble text-wrap max-w-80 p-4">
                {msg}
            </div>  
        </div>
      ))}
    </div>
  );
}