package com.chesstime.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "friend_requests", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"from_user_id", "to_user_id"})
})
@Data
@NoArgsConstructor
public class FriendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "from_user_id", nullable = false)
    private String fromUserId;

    @Column(name = "to_user_id", nullable = false)
    private String toUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FriendRequestStatus status = FriendRequestStatus.PENDING;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
