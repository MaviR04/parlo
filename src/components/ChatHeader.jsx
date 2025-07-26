export function ChatHeader({ teacher }) {
  return (
    <div className="w-full h-20 bg-blue-400 flex gap-10 items-center rounded-b-2xl">
      <div className="avatar avatar-placeholder pl-4">
        <div className="bg-neutral text-neutral-content w-18 h-18 rounded-full">
          <span className="text-2xl">
            {teacher ? teacher.name[0] : "D"}
          </span>
        </div>
      </div>
      <h2 className="font-bold text-2xl">
        {teacher ? teacher.name : "Select a contact"}
      </h2>
    </div>
  );
}
