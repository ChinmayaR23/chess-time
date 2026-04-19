package com.chesstime.repository;

import com.chesstime.model.FriendRequest;
import com.chesstime.model.FriendRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, String> {

    List<FriendRequest> findByToUserIdAndStatus(String toUserId, FriendRequestStatus status);

    List<FriendRequest> findByFromUserIdAndStatus(String fromUserId, FriendRequestStatus status);

    @Query("SELECT f FROM FriendRequest f WHERE (f.fromUserId = :userId OR f.toUserId = :userId) AND f.status = 'ACCEPTED'")
    List<FriendRequest> findFriendsByUserId(@Param("userId") String userId);

    @Query("SELECT f FROM FriendRequest f WHERE (f.fromUserId = :u1 AND f.toUserId = :u2) OR (f.fromUserId = :u2 AND f.toUserId = :u1)")
    Optional<FriendRequest> findAnyBetween(@Param("u1") String u1, @Param("u2") String u2);

    @Query("SELECT f FROM FriendRequest f WHERE ((f.fromUserId = :u1 AND f.toUserId = :u2) OR (f.fromUserId = :u2 AND f.toUserId = :u1)) AND f.status = 'ACCEPTED'")
    Optional<FriendRequest> findFriendship(@Param("u1") String u1, @Param("u2") String u2);
}
