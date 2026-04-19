package com.chesstime.service;

import com.chesstime.model.FriendRequest;
import com.chesstime.model.FriendRequestStatus;
import com.chesstime.model.User;
import com.chesstime.repository.FriendRequestRepository;
import com.chesstime.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;

    @Transactional
    public FriendRequest sendRequest(String fromUserId, String toUserId) {
        if (fromUserId.equals(toUserId)) {
            throw new IllegalArgumentException("Cannot send request to yourself");
        }
        if (!userRepository.existsById(toUserId)) {
            throw new IllegalArgumentException("User not found");
        }
        friendRequestRepository.findAnyBetween(fromUserId, toUserId).ifPresent(r -> {
            throw new IllegalStateException("A friend request already exists between these users");
        });

        FriendRequest req = new FriendRequest();
        req.setFromUserId(fromUserId);
        req.setToUserId(toUserId);
        return friendRequestRepository.save(req);
    }

    @Transactional
    public FriendRequest acceptRequest(String requestId, String userId) {
        FriendRequest req = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!req.getToUserId().equals(userId)) {
            throw new SecurityException("Not authorized");
        }
        if (req.getStatus() != FriendRequestStatus.PENDING) {
            throw new IllegalStateException("Request is not pending");
        }
        req.setStatus(FriendRequestStatus.ACCEPTED);
        return friendRequestRepository.save(req);
    }

    @Transactional
    public void declineRequest(String requestId, String userId) {
        FriendRequest req = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!req.getToUserId().equals(userId)) {
            throw new SecurityException("Not authorized");
        }
        req.setStatus(FriendRequestStatus.DECLINED);
        friendRequestRepository.save(req);
    }

    @Transactional
    public void removeFriend(String userId, String friendId) {
        friendRequestRepository.findFriendship(userId, friendId)
                .ifPresent(friendRequestRepository::delete);
    }

    public List<User> getFriends(String userId) {
        return friendRequestRepository.findFriendsByUserId(userId).stream()
                .map(r -> r.getFromUserId().equals(userId) ? r.getToUserId() : r.getFromUserId())
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Map<String, Object>> getIncomingRequests(String userId) {
        return friendRequestRepository.findByToUserIdAndStatus(userId, FriendRequestStatus.PENDING)
                .stream()
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.getId());
                    m.put("createdAt", r.getCreatedAt());
                    userRepository.findById(r.getFromUserId()).ifPresent(u ->
                            m.put("fromUser", userSummary(u)));
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> getOutgoingRequests(String userId) {
        return friendRequestRepository.findByFromUserIdAndStatus(userId, FriendRequestStatus.PENDING)
                .stream()
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.getId());
                    m.put("createdAt", r.getCreatedAt());
                    userRepository.findById(r.getToUserId()).ifPresent(u ->
                            m.put("toUser", userSummary(u)));
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> searchUsers(String query, String currentUserId) {
        if (query == null || query.trim().length() < 2) return List.of();
        List<User> users = userRepository.findByNameContainingIgnoreCaseAndIdNot(
                query.trim(), currentUserId, PageRequest.of(0, 20));

        return users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("rating", u.getRating());
            m.put("image", u.getImage() != null ? u.getImage() : "");

            String status = "none";
            Optional<FriendRequest> req = friendRequestRepository.findAnyBetween(currentUserId, u.getId());
            if (req.isPresent()) {
                FriendRequest r = req.get();
                if (r.getStatus() == FriendRequestStatus.ACCEPTED) {
                    status = "friends";
                } else if (r.getStatus() == FriendRequestStatus.PENDING) {
                    status = r.getFromUserId().equals(currentUserId) ? "pending_sent" : "pending_received";
                }
            }
            m.put("friendshipStatus", status);
            return m;
        }).toList();
    }

    public boolean areFriends(String userId1, String userId2) {
        return friendRequestRepository.findFriendship(userId1, userId2).isPresent();
    }

    private Map<String, Object> userSummary(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("rating", u.getRating());
        m.put("image", u.getImage() != null ? u.getImage() : "");
        return m;
    }
}
