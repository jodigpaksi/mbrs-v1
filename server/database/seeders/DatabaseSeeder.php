<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'Anita Wijaya',
            'email' => 'anita@corp.com',
            'password' => Hash::make('password'),
            'department' => 'GAA',
            'role' => 'admin',
            'ext' => '102',
            'avatar' => 'Anita',
        ]);

        $user1 = User::create([
            'name' => 'Jessica Miller',
            'email' => 'jessica@corp.com',
            'password' => Hash::make('password'),
            'department' => 'HRD',
            'role' => 'user',
            'ext' => '801',
            'avatar' => 'Aria',
        ]);

        $user2 = User::create([
            'name' => 'Fixer Team',
            'email' => 'mtc@corp.com',
            'password' => Hash::make('password'),
            'department' => 'MTC',
            'role' => 'user',
            'ext' => '000',
            'avatar' => 'Felix',
        ]);

        $ballroom1 = Room::create([
            'name' => 'Ballroom 101', 'type' => 'Ballroom', 'capacity' => 100, 'floor' => 'B1',
            'facilities' => [['name'=>'Sound','icon'=>'volume_up'],['name'=>'Stage','icon'=>'layers'],['name'=>'Projector','icon'=>'videocam'],['name'=>'AC','icon'=>'ac_unit']],
            'photos' => ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800','https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=800'],
            'notes' => 'Suitable for large-scale events. Coordinate with GA team 48hrs before for stage/AV setup.',
        ]);

        $ballroom2 = Room::create([
            'name' => 'Ballroom 102', 'type' => 'Ballroom', 'capacity' => 100, 'floor' => 'B1',
            'facilities' => [['name'=>'Sound','icon'=>'volume_up'],['name'=>'Stage','icon'=>'layers'],['name'=>'AC','icon'=>'ac_unit']],
            'photos' => ['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800'],
            'notes' => 'Suitable for large-scale events.',
        ]);

        Room::create([
            'name' => 'Ballroom 103', 'type' => 'Ballroom', 'capacity' => 80, 'floor' => 'B1',
            'facilities' => [['name'=>'Projector','icon'=>'videocam'],['name'=>'AC','icon'=>'ac_unit']],
            'photos' => ['https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800'],
            'notes' => 'Medium ballroom for events up to 80 pax.',
        ]);

        $exec1 = Room::create([
            'name' => 'Executive 101', 'type' => 'Executive', 'capacity' => 12, 'floor' => '5F',
            'facilities' => [['name'=>'4K TV','icon'=>'tv'],['name'=>'Webcam','icon'=>'photo_camera'],['name'=>'Wifi','icon'=>'wifi'],['name'=>'Whiteboard','icon'=>'border_color']],
            'photos' => ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800','https://images.unsplash.com/photo-1462826303086-329426d1aef5?q=80&w=800'],
            'notes' => 'For senior leadership and external meetings. Video conferencing pre-configured.',
        ]);

        $exec2 = Room::create([
            'name' => 'Executive 102', 'type' => 'Executive', 'capacity' => 12, 'floor' => '5F',
            'facilities' => [['name'=>'4K TV','icon'=>'tv'],['name'=>'Wifi','icon'=>'wifi'],['name'=>'Whiteboard','icon'=>'border_color']],
            'photos' => ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=800'],
            'notes' => 'Executive suite with full AV setup.',
        ]);

        Room::create([
            'name' => 'Executive 103', 'type' => 'Executive', 'capacity' => 8, 'floor' => '4F',
            'facilities' => [['name'=>'TV','icon'=>'tv'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=800'],
            'notes' => 'Smaller executive room for focused discussions.',
        ]);

        $focus1 = Room::create([
            'name' => 'Focus 101', 'type' => 'Focus', 'capacity' => 4, 'floor' => '3F',
            'facilities' => [['name'=>'AC','icon'=>'ac_unit'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800','https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=800'],
            'notes' => 'Quiet zone - no phone calls. Max 4 pax strictly enforced.',
        ]);

        Room::create([
            'name' => 'Focus 102', 'type' => 'Focus', 'capacity' => 4, 'floor' => '3F',
            'facilities' => [['name'=>'AC','icon'=>'ac_unit'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800'],
            'notes' => 'Quiet zone for focused work.',
        ]);

        Room::create([
            'name' => 'Focus 103', 'type' => 'Focus', 'capacity' => 6, 'floor' => '2F',
            'facilities' => [['name'=>'Whiteboard','icon'=>'border_color'],['name'=>'Wifi','icon'=>'wifi']],
            'photos' => ['https://images.unsplash.com/photo-1505409859467-3a799be57c8f?q=80&w=800'],
            'notes' => 'Small meeting room for quick discussions.',
        ]);

        $today = now()->format('Y-m-d');

        Booking::create(['user_id'=>$admin->id,'room_id'=>$ballroom1->id,'title'=>'Weekly Facility Audit','description'=>'Monthly walkthrough covering all floors.','start_at'=>"{$today} 09:00:00",'end_at'=>"{$today} 10:30:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$user1->id,'room_id'=>$exec1->id,'title'=>'Internal Recruitment','description'=>'Panel interview for 2 open positions.','start_at'=>"{$today} 11:00:00",'end_at'=>"{$today} 13:00:00",'status'=>'tentative','type'=>'internal']);
        Booking::create(['user_id'=>$user2->id,'room_id'=>$focus1->id,'title'=>'AC Repair','description'=>'Urgent AC repair session.','start_at'=>"{$today} 14:00:00",'end_at'=>"{$today} 16:00:00",'status'=>'confirmed','type'=>'internal']);
        Booking::create(['user_id'=>$admin->id,'room_id'=>$exec2->id,'title'=>'Vendor Meeting','description'=>'Q2 procurement discussion.','start_at'=>"{$today} 13:00:00",'end_at'=>"{$today} 14:00:00",'status'=>'confirmed','type'=>'external']);
        Booking::create(['user_id'=>$user1->id,'room_id'=>$ballroom2->id,'title'=>'Budget Review','description'=>'Finance sync Q1 actuals vs forecast.','start_at'=>"{$today} 15:00:00",'end_at'=>"{$today} 16:30:00",'status'=>'confirmed','type'=>'internal']);
    }
}
