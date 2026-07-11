"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/SkeletonLoader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useConversations } from "@/hooks/queries/chat/use-chat";
import type { Conversation } from "@/types/api/chat";

export default function ChatListPage() {
  const { data: conversations = [], isLoading } = useConversations();

  if (isLoading) return <ListSkeleton rows={4} />;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No messages yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conversations start when a bid is accepted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {conversations.map((c: Conversation) => {
            const initials = c.other_user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <Link key={c.id} href={`/chat/${c.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {c.other_user.name}
                      </span>
                      {c.last_message?.at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.last_message.at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground truncate">
                        {c.last_message?.preview || "No messages"}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.request_title}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
