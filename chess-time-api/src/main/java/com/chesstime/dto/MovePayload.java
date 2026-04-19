package com.chesstime.dto;

import lombok.Data;

@Data
public class MovePayload {
    private String gameId;
    private String from;
    private String to;
    private String promotion; // nullable
}
