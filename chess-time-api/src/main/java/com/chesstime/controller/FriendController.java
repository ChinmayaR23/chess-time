package com.chesstime.controller;

import com.chesstime.model.User;
import com.chesstime.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friend")
@RequiredArgsConstructor
public class FriendController {

    private final FriendshipService friendshipService;

    @GetMapping("/friends")
    public ResponseEntity<List<Map<String, Object>>> getFriends(@AuthenticationPrincipal String userId) {
        List<User> friends = friendshipService.getFriends(userId);
        List<Map<String, Object>> result = friends.stream()
                .map(u -> Map.<String, Object>of(
                        "id", u.getId(),
                        "name", u.getName(),
                        "rating", u.getRating(),
                        "image", u.getImage() != null ? u.getImage() : ""
                )).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/requests/incoming")
    public ResponseEntity<List<Map<String, Object>>> getIncomingRequests(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(friendshipService.getIncomingRequests(userId));
    }

    @GetMapping("/requests/outgoing")
    public ResponseEntity<List<Map<String, Object>>> getOutgoingRequests(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(friendshipService.getOutgoingRequests(userId));
    }

    @PostMapping("/request/{toUserId}")
    public ResponseEntity<?> sendRequest(@AuthenticationPrincipal String userId,
                                         @PathVariable String toUserId) {
        try {
            friendshipService.sendRequest(userId, toUserId);
            return ResponseEntity.ok(Map.of("message", "Friend request sent"));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/request/{requestId}/accept")
    public ResponseEntity<?> acceptRequest(@AuthenticationPrincipal String userId,
                                           @PathVariable String requestId) {
        try {
            friendshipService.acceptRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Friend request accepted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/request/{requestId}/decline")
    public ResponseEntity<?> declineRequest(@AuthenticationPrincipal String userId,
                                            @PathVariable String requestId) {
        try {
            friendshipService.declineRequest(requestId, userId);
            return ResponseEntity.ok(Map.of("message", "Friend request declined"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<?> removeFriend(@AuthenticationPrincipal String userId,
                                          @PathVariable String friendId) {
        friendshipService.removeFriend(userId, friendId);
        return ResponseEntity.ok(Map.of("message", "Friend removed"));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(@AuthenticationPrincipal String userId,
                                                                  @RequestParam String q) {
        return ResponseEntity.ok(friendshipService.searchUsers(q, userId));
    }
}
