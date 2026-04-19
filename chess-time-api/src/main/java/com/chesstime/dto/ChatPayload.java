package com.chesstime.dto;

import lombok.Data;

@Data
public class ChatPayload {
    private String gameId;
    private String content;
    private String senderName;
    private String senderId; // nullable
}
