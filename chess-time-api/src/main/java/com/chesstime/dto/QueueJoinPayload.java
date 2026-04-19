package com.chesstime.dto;

import lombok.Data;

@Data
public class QueueJoinPayload {
    private int rating;
    private int timeControl;
    private String userId;     // null for guests
    private String guestId;
    private String name;
}
