"use client";

import React, { useEffect, useState, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import { MoreVertical, Trash2, Edit2, Pin, Share, Check, MessageSquare, Search, Sparkles } from "lucide-react";

type Chat = {
  id: string;
  title: string;
  updatedAt: string;
  isPinned?: boolean;
};

export default function ChatSidebar({
  currentChatId,
  onSelectChat,
  onNewChat,
}: {
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
}) {
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [query, setQuery] = useState("");

  // Menu States
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Delete Modal State
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // 🔥 Hydration Fix, Fetch & Custom Event Listener for Auto-Rename
  useEffect(() => {
    setIsMounted(true);
    fetchChats();

    // Listen for the custom event triggered by the ChatInterface after auto-rename
    const handleChatsUpdated = () => fetchChats();
    window.addEventListener("chats-updated", handleChatsUpdated);

    return () => {
      window.removeEventListener("chats-updated", handleChatsUpdated);
    };
  }, [currentChatId]);

  // Click outside to close 3-dot menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchChats() {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setChatList(sorted);
      }
    } catch (e) {
      console.error("Error fetching chats:", e);
    }
  }

  // RENAME ACTION
  async function handleRename(id: string) {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });
      setChatList((prev) => prev.map((c) => (c.id === id ? { ...c, title: editTitle } : c)));
    } catch (error) {
      console.error("Rename failed", error);
    }
    setEditingId(null);
    setOpenMenuId(null);
  }

  // EXECUTE ACTUAL DELETE
  async function executeDelete() {
    if (!chatToDelete) return;
    try {
      await fetch(`/api/chats/${chatToDelete}`, { method: "DELETE" });
      setChatList((prev) => prev.filter((c) => c.id !== chatToDelete));
      if (currentChatId === chatToDelete) onNewChat();
    } catch (error) {
      console.error("Delete failed", error);
    }
    setChatToDelete(null);
  }

  // PIN ACTION
  async function handlePin(id: string, isPinned: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !isPinned }),
      });
      setChatList((prev) => {
        const updated = prev.map((c) => (c.id === id ? { ...c, isPinned: !isPinned } : c));
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      });
    } catch (error) {
      console.error("Pin failed", error);
    }
    setOpenMenuId(null);
  }

  // SHARE ACTION
  function handleShare(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const link = `${window.location.origin}/chat/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    setOpenMenuId(null);
  }

  const filtered = chatList.filter((c) => (c.title || "New Chat").toLowerCase().includes(query.toLowerCase()));

  return (
    <React.Fragment>
      <aside className="w-64 bg-white/90 backdrop-blur-xl h-full flex flex-col pt-4 pb-3 px-3 border-r border-black/5 z-40 relative">
        {/* Brand */}
        <div className="flex items-center gap-2 px-2 mb-4">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm shrink-0"
            style={{ background: "linear-gradient(135deg, #A855F7, #F472B6)" }}
          >
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-semibold text-[15px] text-[#231A2E] tracking-tight">Amina</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0A6C0]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chat"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F1FA] text-sm text-[#3A2E4A] placeholder:text-[#B0A6C0] outline-none focus:ring-2 focus:ring-[#D8B4FE] transition-all"
          />
        </div>

        {/* NEW CHAT BUTTON */}
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 mb-5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
          style={{ background: "linear-gradient(135deg, #A855F7, #F472B6)" }}
        >
          <span className="text-lg leading-none mb-0.5">+</span> New Chat
        </button>

        {/* CHAT LIST */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1" ref={menuRef}>
          <p className="text-[10px] text-[#B0A6C0] px-2 py-1 font-semibold tracking-wider uppercase mb-2">
            Recent Chats
          </p>

          {filtered.length === 0 ? (
            <p className="text-xs text-[#B0A6C0] px-2 italic mt-2">
              {query ? "No matching chats" : "No chats yet…"}
            </p>
          ) : (
            filtered.map((chat) => (
              <div key={chat.id} className="relative group">
                {editingId === chat.id ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-[#F5F1FA] border border-[#D8B4FE]/50 mx-1">
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(chat.id)}
                      className="flex-1 bg-transparent text-sm text-[#231A2E] outline-none"
                    />
                    <button onClick={() => handleRename(chat.id)} className="text-emerald-500 hover:scale-110 transition-transform">
                      <Check size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between transition-all duration-200 ${
                      currentChatId === chat.id
                        ? "bg-[#F3E8FF] text-[#7C3AED] font-medium"
                        : "text-[#5B5468] hover:bg-[#F5F1FA]"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {chat.isPinned ? (
                        <Pin size={12} className="text-[#F472B6] shrink-0 fill-[#F472B6]/20" />
                      ) : (
                        <MessageSquare size={12} className="shrink-0 opacity-50" />
                      )}
                      <span className="truncate">{chat.title || "New Chat"}</span>
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                      }}
                      className={`p-1 rounded-md hover:bg-black/5 transition-colors ${openMenuId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      <MoreVertical size={14} className="text-[#9B92AA]" />
                    </div>
                  </button>
                )}

                {/* THE DROPDOWN MENU */}
                {openMenuId === chat.id && (
                  <div className="absolute right-2 top-10 w-40 bg-white border border-black/5 rounded-xl shadow-xl overflow-hidden z-[100] py-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditTitle(chat.title); setEditingId(chat.id); setOpenMenuId(null); }}
                      className="w-full text-left px-3 py-2 text-xs text-[#3A2E4A] hover:bg-[#F5F1FA] flex items-center gap-2 transition-colors"
                    >
                      <Edit2 size={12} /> Rename
                    </button>
                    <button
                      onClick={(e) => handlePin(chat.id, !!chat.isPinned, e)}
                      className="w-full text-left px-3 py-2 text-xs text-[#3A2E4A] hover:bg-[#F5F1FA] flex items-center gap-2 transition-colors"
                    >
                      <Pin size={12} /> {chat.isPinned ? "Unpin Chat" : "Pin to top"}
                    </button>
                    <button
                      onClick={(e) => handleShare(chat.id, e)}
                      className="w-full text-left px-3 py-2 text-xs text-[#3A2E4A] hover:bg-[#F5F1FA] flex items-center gap-2 transition-colors"
                    >
                      {copiedId === chat.id ? <Check size={12} className="text-emerald-500" /> : <Share size={12} />}
                      {copiedId === chat.id ? "Copied!" : "Share Link"}
                    </button>
                    <div className="h-[1px] bg-black/5 my-1" />

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete(chat.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={12} /> Delete chat
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* USER PROFILE & LOGOUT SECTION */}
        <div className="mt-2 pt-3 border-t border-black/5 flex items-center justify-between px-1 min-h-[48px]">
          <span className="text-xs font-medium text-[#B0A6C0]">My Account</span>

          {isMounted && (
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                variables: {
                  colorPrimary: "#A855F7",
                  colorBackground: "#FFFFFF",
                  colorText: "#231A2E",
                  colorTextSecondary: "#5B5468",
                  colorInputText: "#231A2E",
                  colorNeutral: "#231A2E",
                },
                elements: {
                  userButtonPopoverCard: "border border-black/5 shadow-xl bg-white",
                  userButtonPopoverFooter: "hidden",
                  userButtonPopoverActionButtonText: "text-[#3A2E4A]",
                  userButtonPopoverActionButtonIcon: "text-[#5B5468]",
                  userPreviewMainIdentifier: "text-[#231A2E]",
                  userPreviewSecondaryIdentifier: "text-[#9B92AA]",
                },
              }}
            />
          )}
        </div>
      </aside>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-black/5 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#231A2E]">Delete Chat?</h3>
            </div>

            <p className="text-sm text-[#9B92AA] mb-6 mt-2 ml-1">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setChatToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#F5F1FA] hover:bg-[#EDE4F7] text-[#3A2E4A] text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}